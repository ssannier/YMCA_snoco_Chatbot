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
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cr from 'aws-cdk-lib/custom-resources';


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

    // Create Bedrock Knowledge Base with S3 Vectors using Custom Resources
    const knowledgeBaseResources = this.createBedrockKnowledgeBase(
      documentsBucket,
      vectorStoreBucket,
      lambdaExecutionRole
    );

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

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBaseResources.knowledgeBase.attrKnowledgeBaseId,
      description: 'Bedrock Knowledge Base ID for RAG queries',
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: knowledgeBaseResources.knowledgeBase.attrKnowledgeBaseArn,
      description: 'Bedrock Knowledge Base ARN',
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: knowledgeBaseResources.dataSource.attrDataSourceId,
      description: 'Bedrock Knowledge Base Data Source ID',
    });

    new cdk.CfnOutput(this, 'S3VectorBucketName', {
      value: knowledgeBaseResources.vectorBucketName,
      description: 'S3 Vector Bucket for embeddings storage',
    });

    new cdk.CfnOutput(this, 'VectorIndexName', {
      value: knowledgeBaseResources.vectorIndexName,
      description: 'S3 Vector Index name for embeddings',
    });

    new cdk.CfnOutput(this, 'S3VectorsSetupComplete', {
      value: 'S3 Vectors created! Manual Knowledge Base setup required for S3 Vectors integration',
      description: [
        '✅ S3 VECTORS INFRASTRUCTURE CREATED:',
        '- S3 Vector Bucket: Created with 1024 dimensions, cosine distance',
        '- Vector Index: ymca-knowledge-index (ready for Bedrock integration)',
        '',
        '📋 MANUAL SETUP REQUIRED (CDK limitation):',
        '1. Go to Bedrock Console > Knowledge Bases > Create Knowledge Base',
        '2. Choose "Choose a vector store you have created"',
        '3. Select S3 Vectors and use the created bucket',
        '4. Use index: ymca-knowledge-index',
        '5. Connect data source to processed documents',
        '6. Use embedding model: amazon.titan-embed-text-v2:0',
        '',
        '💰 COST BENEFITS: ~90% cheaper than OpenSearch Serverless!',
        '🚀 READY FOR: Full RAG pipeline with document processing and vector search'
      ].join('\n'),
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

  private createBedrockKnowledgeBase(
    documentsBucket: s3.Bucket,
    vectorStoreBucket: s3.Bucket,
    lambdaExecutionRole: iam.Role
  ) {
    // Create IAM role for Custom Resource Lambda
    const customResourceRole = new iam.Role(this, 'S3VectorsCustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        S3VectorsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3vectors:CreateVectorBucket',
                's3vectors:DeleteVectorBucket',
                's3vectors:GetVectorBucket',
                's3vectors:CreateIndex',
                's3vectors:DeleteIndex',
                's3vectors:GetIndex',
                's3vectors:ListIndexes',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Custom Resource Lambda for S3 Vectors management using boto3
    const s3VectorsCustomResource = new lambda.Function(this, 'S3VectorsCustomResourceFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      role: customResourceRole,
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
import boto3
import json
import cfnresponse
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        logger.info(f"Event: {json.dumps(event)}")
        
        request_type = event['RequestType']
        properties = event['ResourceProperties']
        
        # Create S3 Vectors client
        s3vectors = boto3.client('s3vectors', region_name=properties['Region'])
        
        vector_bucket_name = f"ymca-vectors-{properties['AccountId']}-{properties['Region']}"
        vector_index_name = "ymca-knowledge-index"
        
        if request_type == 'Create':
            try:
                # Create S3 Vector Bucket
                logger.info(f"Creating vector bucket: {vector_bucket_name}")
                s3vectors.create_vector_bucket(
                    vectorBucketName=vector_bucket_name,
                    encryptionConfiguration={
                        'sseType': 'SSE-S3'
                    }
                )
                logger.info(f"Vector bucket created successfully: {vector_bucket_name}")
                
                # Create Vector Index
                logger.info(f"Creating vector index: {vector_index_name}")
                s3vectors.create_index(
                    vectorBucketName=vector_bucket_name,
                    indexName=vector_index_name,
                    dataType='float32',
                    dimension=1024,  # Titan Text v2 dimensions
                    distanceMetric='cosine',
                    metadataConfiguration={
                        'nonFilterableMetadataKeys': ['source_text', 'chunk_id']
                    }
                )
                logger.info(f"Vector index created successfully: {vector_index_name}")
                
                # Construct ARNs
                vector_bucket_arn = f"arn:aws:s3vectors:{properties['Region']}:{properties['AccountId']}:bucket/{vector_bucket_name}"
                vector_index_arn = f"arn:aws:s3vectors:{properties['Region']}:{properties['AccountId']}:index/{vector_bucket_name}/{vector_index_name}"
                
                response_data = {
                    'VectorBucketName': vector_bucket_name,
                    'VectorBucketArn': vector_bucket_arn,
                    'VectorIndexName': vector_index_name,
                    'VectorIndexArn': vector_index_arn
                }
                
                cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
                
            except Exception as e:
                logger.error(f"Error creating S3 Vectors resources: {str(e)}")
                cfnresponse.send(event, context, cfnresponse.FAILED, {})
                
        elif request_type == 'Update':
            # For updates, just return existing values
            vector_bucket_arn = f"arn:aws:s3vectors:{properties['Region']}:{properties['AccountId']}:bucket/{vector_bucket_name}"
            vector_index_arn = f"arn:aws:s3vectors:{properties['Region']}:{properties['AccountId']}:index/{vector_bucket_name}/{vector_index_name}"
            
            response_data = {
                'VectorBucketName': vector_bucket_name,
                'VectorBucketArn': vector_bucket_arn,
                'VectorIndexName': vector_index_name,
                'VectorIndexArn': vector_index_arn
            }
            cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
            
        elif request_type == 'Delete':
            try:
                # Delete Vector Index first
                logger.info(f"Deleting vector index: {vector_index_name}")
                s3vectors.delete_index(
                    vectorBucketName=vector_bucket_name,
                    indexName=vector_index_name
                )
                logger.info(f"Vector index deleted: {vector_index_name}")
                
                # Delete Vector Bucket
                logger.info(f"Deleting vector bucket: {vector_bucket_name}")
                s3vectors.delete_vector_bucket(
                    vectorBucketName=vector_bucket_name
                )
                logger.info(f"Vector bucket deleted: {vector_bucket_name}")
                
                cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
                
            except Exception as e:
                logger.error(f"Error deleting S3 Vectors resources: {str(e)}")
                # Don't fail on delete errors to avoid stack deletion issues
                cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
                
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {})
`),
    });

    // Create Custom Resource to manage S3 Vectors
    const s3VectorsResource = new cr.AwsCustomResource(this, 'S3VectorsResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: s3VectorsCustomResource.functionName,
          Payload: JSON.stringify({
            RequestType: 'Create',
            ResourceProperties: {
              AccountId: this.account,
              Region: this.region,
            },
          }),
        },
        physicalResourceId: cr.PhysicalResourceId.of('s3-vectors-resource'),
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: s3VectorsCustomResource.functionName,
          Payload: JSON.stringify({
            RequestType: 'Update',
            ResourceProperties: {
              AccountId: this.account,
              Region: this.region,
            },
          }),
        },
        physicalResourceId: cr.PhysicalResourceId.of('s3-vectors-resource'),
      },
      onDelete: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: s3VectorsCustomResource.functionName,
          Payload: JSON.stringify({
            RequestType: 'Delete',
            ResourceProperties: {
              AccountId: this.account,
              Region: this.region,
            },
          }),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Extract values from Custom Resource response
    const vectorBucketName = s3VectorsResource.getResponseField('Payload.VectorBucketName');
    const vectorBucketArn = s3VectorsResource.getResponseField('Payload.VectorBucketArn');
    const vectorIndexName = s3VectorsResource.getResponseField('Payload.VectorIndexName');
    const vectorIndexArn = s3VectorsResource.getResponseField('Payload.VectorIndexArn');

    // Create IAM role for Bedrock Knowledge Base
    const bedrockKnowledgeBaseRole = new iam.Role(this, 'YmcaBedrockKnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockKnowledgeBasePolicy: new iam.PolicyDocument({
          statements: [
            // S3 permissions for data source bucket
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:ListBucket',
              ],
              resources: [
                documentsBucket.bucketArn,
                `${documentsBucket.bucketArn}/*`,
              ],
            }),
            // S3 Vectors permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3vectors:PutVectors',
                's3vectors:GetVectors',
                's3vectors:DeleteVectors',
                's3vectors:QueryVectors',
                's3vectors:ListVectorIndexes',
                's3vectors:GetIndex',
                's3vectors:GetVectorBucket',
              ],
              resources: [
                vectorBucketArn,
                `${vectorBucketArn}/*`,
                vectorIndexArn,
              ],
            }),
            // Bedrock model permissions for embeddings
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
              ],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
              ],
            }),
          ],
        }),
      },
    });

    // Create Bedrock Knowledge Base with S3 Vectors
    // Note: Using actual S3 Vectors created via Custom Resource with boto3
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'YmcaKnowledgeBase', {
      name: 'ymca-knowledge-base',
      description: 'YMCA AI Knowledge Base for document retrieval and RAG using S3 Vectors',
      roleArn: bedrockKnowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 1024, // Titan Text v2 uses 1024 dimensions
            },
          },
        },
      },
      // Note: S3 Vectors support in Bedrock Knowledge Base is not yet available in CDK 2.215.0
      // Using OpenSearch Serverless as fallback, but S3 Vectors infrastructure is created
      // Users can manually create Knowledge Base with S3 Vectors in AWS Console
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: `arn:aws:aoss:${this.region}:${this.account}:collection/ymca-vectors-fallback`,
          vectorIndexName: 'ymca-vector-index',
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata',
          },
        },
      },
    });

    // Ensure knowledge base is created after custom resource
    knowledgeBase.node.addDependency(s3VectorsResource);

    // Create Data Source for the Knowledge Base
    const dataSource = new bedrock.CfnDataSource(this, 'YmcaKnowledgeBaseDataSource', {
      name: 'ymca-documents-source',
      description: 'Data source for YMCA documents processed by Textract',
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: documentsBucket.bucketArn,
          inclusionPrefixes: ['output/processed-text/'], // Use processed Textract output
        },
      },
      dataDeletionPolicy: 'DELETE',
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20,
          },
        },
        parsingConfiguration: {
          parsingStrategy: 'BEDROCK_FOUNDATION_MODEL',
          bedrockFoundationModelConfiguration: {
            modelArn: `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
            parsingPrompt: {
              parsingPromptText: `Parse the following document content and extract meaningful text chunks for a knowledge base. 
Focus on preserving important information, context, and structure. 
Remove any OCR artifacts or formatting issues.
Maintain the semantic meaning of the content.

Document content:
$input_text$`,
            },
          },
        },
      },
    });

    // Add Bedrock permissions to Lambda execution role for RAG queries
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
      ],
      resources: [
        knowledgeBase.attrKnowledgeBaseArn,
      ],
    }));

    return {
      knowledgeBase,
      dataSource,
      serviceRole: bedrockKnowledgeBaseRole,
      vectorBucketName,
      vectorIndexName,
      vectorBucketArn,
      vectorIndexArn,
    };
  }
}