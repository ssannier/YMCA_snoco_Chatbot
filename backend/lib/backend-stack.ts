import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';

export class YmcaAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for document storage with input/ and output/ prefixes
    // input/ - stores initial documents uploaded for processing
    // output/ - stores processed output from textract pipeline
    const documentsBucket = new s3.Bucket(this, 'YmcaDocumentsBucket', {
      bucketName: `ymca-documents-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // S3 Bucket for vector embeddings storage
    const vectorStoreBucket = new s3.Bucket(this, 'YmcaVectorStoreBucket', {
      bucketName: `ymca-vector-store-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // DynamoDB Tables for analytics and conversation tracking
    const conversationTable = new dynamodb.Table(this, 'YmcaConversationTable', {
      tableName: 'ymca-conversations',
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const analyticsTable = new dynamodb.Table(this, 'YmcaAnalyticsTable', {
      tableName: 'ymca-analytics',
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
                vectorStoreBucket.bucketArn,
                `${vectorStoreBucket.bucketArn}/*`,
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
            // Bedrock permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate',
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

    // Lambda function placeholders (will be implemented in subsequent tasks)
    const agentProxyFunction = new lambda.Function(this, 'YmcaAgentProxyFunction', {
      functionName: 'ymca-agent-proxy',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Agent Proxy Lambda - Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
              'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({
              message: 'YMCA AI Agent Proxy - Not yet implemented',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        CONVERSATION_TABLE_NAME: conversationTable.tableName,
        ANALYTICS_TABLE_NAME: analyticsTable.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        VECTOR_STORE_BUCKET: vectorStoreBucket.bucketName,
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
      },
    });

    const textractPostprocessorFunction = new lambda.Function(this, 'YmcaTextractPostprocessorFunction', {
      functionName: 'ymca-textract-postprocessor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/textract-postprocessor'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        VECTOR_STORE_BUCKET: vectorStoreBucket.bucketName,
      },
    });

    const checkTextractStatusFunction = new lambda.Function(this, 'YmcaCheckTextractStatusFunction', {
      functionName: 'ymca-check-textract-status',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/check-textract-status'),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
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

    // API Gateway integration with Lambda
    const chatIntegration = new apigateway.LambdaIntegration(agentProxyFunction);

    // API routes
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', chatIntegration);

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

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
      description: 'S3 bucket for YMCA documents (input/ and output/ prefixes)',
    });

    new cdk.CfnOutput(this, 'VectorStoreBucketName', {
      value: vectorStoreBucket.bucketName,
      description: 'S3 bucket for vector embeddings storage',
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

    // Wait state for Textract async processing
    const waitForTextract = new stepfunctions.Wait(this, 'WaitForTextract', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(60)),
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

    // Define the workflow with proper status checking
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

    // Create the state machine
    const stateMachine = new stepfunctions.StateMachine(this, 'YmcaDocumentProcessingWorkflow', {
      stateMachineName: 'ymca-document-processing',
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
    });

    return stateMachine;
  }
}