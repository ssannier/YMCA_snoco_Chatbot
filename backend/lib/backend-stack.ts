import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as amplifyAlpha from '@aws-cdk/aws-amplify-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export class YmcaAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for document storage with input/ and output/ prefixes
    // input/ - stores initial documents uploaded for processing
    // output/ - stores processed output from textract pipeline (used by Bedrock Knowledge Base)
    const documentsBucket = new s3.Bucket(this, 'YmcaDocumentsBucket', {
      bucketName: process.env.DOCUMENTS_BUCKET || `ymca-documents-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // DynamoDB Tables for analytics and conversation tracking
    const conversationTable = new dynamodb.Table(this, 'YmcaConversationTable', {
      tableName: process.env.CONVERSATION_TABLE || 'ymca-conversations',
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const analyticsTable = new dynamodb.Table(this, 'YmcaAnalyticsTable', {
      tableName: process.env.ANALYTICS_TABLE || 'ymca-analytics',
      partitionKey: { name: 'queryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // IAM Role for Lambda functions (excluding batch processor)
    const lambdaExecutionRole = new iam.Role(this, 'YmcaLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        YmcaAiPolicy: new iam.PolicyDocument({
          statements: [
            // S3 permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                documentsBucket.bucketArn,
                `${documentsBucket.bucketArn}/*`,
              ],
            }),
            // DynamoDB permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                conversationTable.tableArn,
                analyticsTable.tableArn,
              ],
            }),
            // Textract permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'textract:StartDocumentTextDetection',
                'textract:GetDocumentTextDetection',
                'textract:StartDocumentAnalysis',
                'textract:GetDocumentAnalysis',
              ],
              resources: ['*'],
            }),
            // Bedrock permissions - for foundation models (all regions) and inference profiles
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                `arn:aws:bedrock:*::foundation-model/*`, // Allow cross-region routing
                `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate',
                'bedrock:ListKnowledgeBases',
                'bedrock:GetKnowledgeBase',
              ],
              resources: [
                `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'translate:TranslateText',
                'comprehend:DetectDominantLanguage',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Separate IAM Role for Batch Processor (will get Step Functions permissions later)
    const batchProcessorRole = new iam.Role(this, 'YmcaBatchProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        S3Policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [`${documentsBucket.bucketArn}/*`],
            }),
          ],
        }),
      },
    });

    // Lambda function for standard (non-streaming) requests
    const agentProxyFunction = new lambda.Function(this, 'YmcaAgentProxyFunction', {
      functionName: 'ymca-agent-proxy',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-proxy'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        CONVERSATION_TABLE_NAME: conversationTable.tableName,
        ANALYTICS_TABLE_NAME: analyticsTable.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        KNOWLEDGE_BASE_ID: process.env.KB_ID || '',
        REGION: process.env.AWS_REGION || this.region,
      },
    });

    // Lambda function for streaming requests with response streaming enabled
    const agentProxyStreamingFunction = new lambda.Function(this, 'YmcaAgentProxyStreamingFunction', {
      functionName: 'ymca-agent-proxy-streaming',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.streamingHandler',
      code: lambda.Code.fromAsset('lambda/agent-proxy'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        CONVERSATION_TABLE_NAME: conversationTable.tableName,
        ANALYTICS_TABLE_NAME: analyticsTable.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        KNOWLEDGE_BASE_ID: process.env.KB_ID || '',
        REGION: process.env.AWS_REGION || this.region,
      },
    });

    // Add Function URL with streaming enabled for the streaming function
    const streamingFunctionUrl = agentProxyStreamingFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Document processing Lambda functions using external code
    const batchProcessorFunction = new lambda.Function(this, 'YmcaBatchProcessorFunction', {
      functionName: 'ymca-batch-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/batch-processor'),
      role: batchProcessorRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        REGION: process.env.AWS_REGION || this.region,
        // STEP_FUNCTION_ARN will be added after workflow creation
      },
    });

    const textractAsyncFunction = new lambda.Function(this, 'YmcaTextractAsyncFunction', {
      functionName: 'ymca-textract-async',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/textract-async'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        REGION: process.env.AWS_REGION || this.region,
      },
    });

    const textractPostprocessorFunction = new lambda.Function(this, 'YmcaTextractPostprocessorFunction', {
      functionName: 'ymca-textract-postprocessor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/textract-postprocessor'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15), // Keep 15 minutes for processing large documents
      memorySize: 2048, // Increase memory for large document processing
      environment: {
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        REGION: process.env.AWS_REGION || this.region,
      },
    });

    const checkTextractStatusFunction = new lambda.Function(this, 'YmcaCheckTextractStatusFunction', {
      functionName: 'ymca-check-textract-status',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/check-textract-status'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        REGION: process.env.AWS_REGION || this.region,
      },
    });

    // Cognito User Pool for Admin Authentication
    const userPool = new cognito.UserPool(this, 'YmcaAdminUserPool', {
      userPoolName: 'ymca-admin-user-pool',
      selfSignUpEnabled: false, // Only admins can create users
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev; use RETAIN for prod
    });

    const userPoolClient = userPool.addClient('YmcaAdminUserPoolClient', {
      userPoolClientName: 'ymca-admin-client',
      generateSecret: false, // Web clients can't handle secrets
      authFlows: {
        userSrp: true,
      },
    });

    // API Gateway for REST API
    const api = new apigateway.RestApi(this, 'YmcaAiApi', {
      restApiName: 'YMCA AI API',
      description: 'API for YMCA AI multilingual chatbot system',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // API Gateway integration with Lambda (non-streaming)
    const chatIntegration = new apigateway.LambdaIntegration(agentProxyFunction);

    // API routes
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', chatIntegration);

    // Streaming endpoint with response streaming enabled
    const chatStreamResource = api.root.addResource('chat-stream');

    // Use AwsIntegration for response streaming with the correct Lambda streaming API endpoint
    const chatStreamIntegration = new apigateway.AwsIntegration({
      service: 'lambda',
      path: `2021-11-15/functions/${agentProxyStreamingFunction.functionArn}/response-stream-invocations`,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: new iam.Role(this, 'StreamingApiRole', {
          assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
          inlinePolicies: {
            InvokeLambda: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['lambda:InvokeFunction', 'lambda:InvokeWithResponseStream'],
                  resources: [agentProxyStreamingFunction.functionArn],
                }),
              ],
            }),
          },
        }),
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Content-Type': "'text/event-stream'",
            },
          },
        ],
      },
    });

    chatStreamResource.addMethod('POST', chatStreamIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Content-Type': true,
          },
        },
      ],
    });

    // Document upload endpoint
    const uploadResource = api.root.addResource('upload');
    const uploadIntegration = new apigateway.AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'PUT',
      path: `${documentsBucket.bucketName}/input/{key}`,
      options: {
        credentialsRole: new iam.Role(this, 'ApiGatewayS3Role', {
          assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
          inlinePolicies: {
            S3PutPolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: ['s3:PutObject'],
                  resources: [`${documentsBucket.bucketArn}/input/*`],
                }),
              ],
            }),
          },
        }),
        requestParameters: {
          'integration.request.path.key': 'method.request.path.key',
          'integration.request.header.Content-Type': 'method.request.header.Content-Type',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      },
    });

    const keyResource = uploadResource.addResource('{key}');
    keyResource.addMethod('PUT', uploadIntegration, {
      requestParameters: {
        'method.request.path.key': true,
        'method.request.header.Content-Type': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Step Functions workflow for document processing pipeline
    const documentProcessingWorkflow = this.createDocumentProcessingWorkflow(
      textractAsyncFunction,
      textractPostprocessorFunction,
      checkTextractStatusFunction
    );

    // S3 event notification to trigger document processing workflow
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(batchProcessorFunction),
      { prefix: 'input/' }
    );

    // Update batch processor to trigger Step Functions - do this after workflow creation
    batchProcessorFunction.addEnvironment('STEP_FUNCTION_ARN', documentProcessingWorkflow.stateMachineArn);
    documentProcessingWorkflow.grantStartExecution(batchProcessorFunction);
    
    // Add Step Functions permissions to batch processor role
    batchProcessorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'states:StartExecution',
        'states:DescribeExecution',
      ],
      resources: [documentProcessingWorkflow.stateMachineArn],
    }));

    // Outputs for reference
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'YMCA AI API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'ChatEndpoint', {
      value: `${api.url}chat`,
      description: 'Non-streaming chat endpoint',
    });

    new cdk.CfnOutput(this, 'ChatStreamingEndpoint', {
      value: `${api.url}chat-stream`,
      description: 'Streaming chat endpoint with real-time response (API Gateway - may have limitations)',
    });

    new cdk.CfnOutput(this, 'StreamingFunctionUrl', {
      value: streamingFunctionUrl.url,
      description: 'Lambda Function URL with native streaming support (recommended for streaming)',
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
      description: 'S3 bucket for YMCA documents (input/ for uploads, output/ for Bedrock Knowledge Base)',
    });

    new cdk.CfnOutput(this, 'ConversationTableName', {
      value: conversationTable.tableName,
      description: 'DynamoDB table for conversation storage',
    });

    new cdk.CfnOutput(this, 'AnalyticsTableName', {
      value: analyticsTable.tableName,
      description: 'DynamoDB table for analytics data',
    });

    new cdk.CfnOutput(this, 'DocumentProcessingWorkflowArn', {
      value: documentProcessingWorkflow.stateMachineArn,
      description: 'Step Functions state machine for document processing pipeline',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID for Admin Auth',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });


    // ========================================================================
    // AMPLIFY FRONTEND DEPLOYMENT
    // ========================================================================

    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    // Optional: Only throw if you intend to deploy Amplify. 
    // For now, we'll check if they are present before creating Amplify resources.
    
    if (githubToken && githubOwner && githubRepo) {
      const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubToken', {
        secretName: 'github-secret-token-ymca',
        description: 'GitHub Personal Access Token for Amplify',
        secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
      });

      const amplifyApp = new amplifyAlpha.App(this, 'YmcaAmplifyApp', {
        sourceCodeProvider: new amplifyAlpha.GitHubSourceCodeProvider({
          owner: githubOwner,
          repository: githubRepo,
          oauthToken: githubTokenSecret.secretValue,
        }),
        buildSpec: codebuild.BuildSpec.fromObjectToYaml({
          version: '1.0',
          frontend: {
            phases: {
              preBuild: {
                commands: ['cd frontend', 'npm ci'],
              },
              build: {
                commands: ['cd frontend', 'npm run build'],
              },
            },
            artifacts: {
              baseDirectory: 'frontend/.next', 
              files: ['**/*'],
            },
            cache: {
              paths: ['frontend/node_modules/**/*'],
            },
          },
        }),
      });

      const mainBranch = amplifyApp.addBranch('main', {
        autoBuild: true,
        stage: 'PRODUCTION',
      });

      // Inject Environment Variables into Amplify
      mainBranch.addEnvironment('NEXT_PUBLIC_API_URL', api.url);
      mainBranch.addEnvironment('NEXT_PUBLIC_CHAT_ENDPOINT', `${api.url}chat`);
      mainBranch.addEnvironment('NEXT_PUBLIC_CHAT_STREAM_ENDPOINT', streamingFunctionUrl.url); // Preferred over API GW for streaming
      mainBranch.addEnvironment('NEXT_PUBLIC_USER_POOL_ID', userPool.userPoolId);
      mainBranch.addEnvironment('NEXT_PUBLIC_USER_POOL_CLIENT_ID', userPoolClient.userPoolClientId);
      mainBranch.addEnvironment('NEXT_PUBLIC_REGION', this.region);

      githubTokenSecret.grantRead(amplifyApp);

      // Trigger build on deployment
      new AwsCustomResource(this, 'TriggerAmplifyBuild', {
        onCreate: {
          service: 'Amplify',
          action: 'startJob',
          parameters: {
            appId: amplifyApp.appId,
            branchName: mainBranch.branchName,
            jobType: 'RELEASE',
          },
          physicalResourceId: PhysicalResourceId.of(`${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`),
        },
        onUpdate: {
          service: 'Amplify',
          action: 'startJob',
          parameters: {
            appId: amplifyApp.appId,
            branchName: mainBranch.branchName,
            jobType: 'RELEASE',
          },
          physicalResourceId: PhysicalResourceId.of(`${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: [
            `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}`,
            `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}/branches/${mainBranch.branchName}/jobs/*`,
          ],
        }),
      });

      new cdk.CfnOutput(this, 'AmplifyAppUrl', {
        value: `https://main.${amplifyApp.defaultDomain}`,
        description: 'Amplify App URL',
      });
    }

    new cdk.CfnOutput(this, 'PostDeploymentInstructions', {
      value: `
NEXT STEPS:
1. Bedrock Knowledge Base:
   - Go to AWS Console > Bedrock > Knowledge bases
   - Create knowledge base with S3 data source (Bucket: ${documentsBucket.bucketName}, Prefix: output/)
   - Select "Titan Text Embeddings V2" model, "Quick create a new vector store"
   - Update KB_ID in .env file

2. Admin User Setup:
   - Go to AWS Console > Cognito > User pools > ymca-admin-user-pool
   - Create a new user (email/password)
   - Mark email as verified
   - This user will be able to access the Admin Dashboard

3. GitHub Configuration (for Amplify):
   - Ensure GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO are set in backend/.env
   - GITHUB_TOKEN must be a Personal Access Token with 'repo' and 'admin:repo_hook' scopes
      `,
      description: 'Post-deployment setup instructions',
    });
  }

  private createDocumentProcessingWorkflow(
    textractAsync: lambda.Function,
    textractPostprocessor: lambda.Function,
    checkStatusFunction: lambda.Function
  ): stepfunctions.StateMachine {
    
    // Define Step Functions tasks
    const startTextractTask = new stepfunctionsTasks.LambdaInvoke(this, 'StartTextractTask', {
      lambdaFunction: textractAsync,
      outputPath: '$.Payload',
    });

    // Wait state for Textract async processing - longer wait for large documents
    const waitForTextract = new stepfunctions.Wait(this, 'WaitForTextract', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(120)), // 2 minutes between checks
    });

    // Check Textract job status using external function
    const checkTextractStatus = new stepfunctionsTasks.LambdaInvoke(this, 'CheckTextractStatus', {
      lambdaFunction: checkStatusFunction,
      outputPath: '$.Payload',
    });

    // Process Textract results
    const processTextractResults = new stepfunctionsTasks.LambdaInvoke(this, 'ProcessTextractResults', {
      lambdaFunction: textractPostprocessor,
      outputPath: '$.Payload',
    });

    // Success state
    const processingComplete = new stepfunctions.Succeed(this, 'ProcessingComplete', {
      comment: 'Document processing completed successfully',
    });

    // Failure state
    const processingFailed = new stepfunctions.Fail(this, 'ProcessingFailed', {
      comment: 'Document processing failed',
    });

    // Define the workflow with proper status checking and loop protection
    const definition = startTextractTask
      .next(waitForTextract)
      .next(checkTextractStatus)
      .next(new stepfunctions.Choice(this, 'IsTextractComplete')
        .when(
          stepfunctions.Condition.stringEquals('$.status', 'SUCCEEDED'),
          processTextractResults.next(processingComplete)
        )
        .when(
          stepfunctions.Condition.stringEquals('$.status', 'FAILED'),
          processingFailed
        )
        .when(
          stepfunctions.Condition.stringEquals('$.status', 'PARTIAL_SUCCESS'),
          processingFailed
        )
        .otherwise(waitForTextract) // Continue waiting if IN_PROGRESS
      );

    // Create the state machine with extended timeout for large documents
    const stateMachine = new stepfunctions.StateMachine(this, 'YmcaDocumentProcessingWorkflow', {
      stateMachineName: 'ymca-document-processing',
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.hours(2), // 2 hours for very large documents
    });

    return stateMachine;
  }
}