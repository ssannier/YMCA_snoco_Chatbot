const {
  TextractClient,
  GetDocumentTextDetectionCommand,
  GetDocumentAnalysisCommand
} = require('@aws-sdk/client-textract');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockAgentClient, StartIngestionJobCommand } = require('@aws-sdk/client-bedrock-agent');

const textractClient = new TextractClient({});
const s3Client = new S3Client({});
const bedrockAgentClient = new BedrockAgentClient({});

/**
 * YMCA AI Textract Postprocessor Lambda Function
 * Retrieves Textract results and processes them for knowledge base ingestion
 * Handles both text detection and document analysis results with pagination
 */
exports.handler = async (event) => {
  console.log('Textract Postprocessor Lambda - Event:', JSON.stringify(event, null, 2));
  
  try {
    const { jobId, bucketName, objectKey, processingId, operationType } = event;
    
    if (!jobId) {
      throw new Error('Missing jobId in event');
    }

    console.log(`Processing Textract results for job: ${jobId} (${operationType})`);

    // Get ALL Textract results with pagination
    const allBlocks = await getAllTextractResults(jobId, operationType);
    
    console.log(`Retrieved ${allBlocks.length} total blocks from Textract`);

    // Process the results based on operation type
    let processedContent;
    if (operationType === 'ANALYSIS') {
      processedContent = processDocumentAnalysis(allBlocks);
    } else {
      processedContent = processTextDetection(allBlocks);
    }

    console.log(`Extracted content: ${processedContent.text.length} characters, ${processedContent.pageCount} pages`);

    // Save processed content to S3 output/ folder for Bedrock Knowledge Base ingestion
    const outputKey = `output/processed-text/${processingId}/${objectKey.replace(/^input\//, '')}.json`;
    
    const processedData = {
      sourceDocument: objectKey,
      processingId,
      timestamp: new Date().toISOString(),
      operationType,
      textContent: processedContent.text,
      metadata: {
        pageCount: processedContent.pageCount,
        wordCount: processedContent.wordCount,
        hasStructuredData: processedContent.hasStructuredData,
        confidence: processedContent.averageConfidence,
        totalBlocks: allBlocks.length
      },
      structuredData: processedContent.structuredData
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.DOCUMENTS_BUCKET,
      Key: outputKey,
      Body: JSON.stringify(processedData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'source-document': objectKey,
        'processing-id': processingId,
        'operation-type': operationType,
        'page-count': processedContent.pageCount.toString()
      }
    }));

    console.log(`Processed content saved to: ${outputKey}`);

    // Extract year and metadata from filename for Bedrock KB filtering
    const yearMatch = objectKey.match(/(\d{4})/);
    const documentYear = yearMatch ? yearMatch[1] : 'unknown';
    const documentDecade = yearMatch ? `${yearMatch[1].substring(0, 3)}0s` : 'unknown';

    // Determine era based on year
    let era = 'unknown';
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year < 1900) era = 'founding';
      else if (year < 1950) era = 'early-20th-century';
      else if (year < 1980) era = 'mid-20th-century';
      else era = 'modern';
    }

    // Create separate metadata file for Bedrock KB filtering
    // Following AWS best practice: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-metadata.html
    const metadataKey = `${outputKey}.metadata.json`;
    const bedrockMetadata = {
      metadataAttributes: {
        year: documentYear,
        decade: documentDecade,
        era: era,
        documentType: 'historical-archive',
        pageCount: processedContent.pageCount,
        wordCount: processedContent.wordCount,
        sourceFile: objectKey.split('/').pop()
      }
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.DOCUMENTS_BUCKET,
      Key: metadataKey,
      Body: JSON.stringify(bedrockMetadata, null, 2),
      ContentType: 'application/json'
    }));

    console.log(`Metadata file saved to: ${metadataKey}`);
    console.log(`Document metadata: ${JSON.stringify(bedrockMetadata.metadataAttributes)}`);

    // Automatically sync Knowledge Base after document processing
    let ingestionJobId = null;
    try {
      console.log('Triggering Knowledge Base sync...');
      const ingestionResult = await syncKnowledgeBase();
      ingestionJobId = ingestionResult.ingestionJobId;
      console.log(`Knowledge Base sync started: ${ingestionJobId}`);
    } catch (syncError) {
      console.error('Failed to sync Knowledge Base (non-fatal):', syncError);
      // Don't fail the whole process if KB sync fails
    }

    return {
      statusCode: 200,
      message: 'Text extraction and processing completed successfully',
      outputKey,
      metadataKey,
      processingId,
      textLength: processedContent.text.length,
      pageCount: processedContent.pageCount,
      originalDocument: objectKey,
      structuredDataFound: processedContent.hasStructuredData,
      totalBlocks: allBlocks.length,
      metadata: bedrockMetadata.metadataAttributes,
      knowledgeBaseSyncJobId: ingestionJobId
    };
  } catch (error) {
    console.error('Error processing Textract results:', error);
    return {
      statusCode: 500,
      error: error.message,
      processingId: event.processingId,
      originalDocument: event.objectKey
    };
  }
};

/**
 * Sync Knowledge Base by starting an ingestion job
 */
async function syncKnowledgeBase() {
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;
  const dataSourceId = process.env.DATA_SOURCE_ID;

  if (!knowledgeBaseId || !dataSourceId) {
    console.warn('Knowledge Base ID or Data Source ID not configured, skipping sync');
    return { ingestionJobId: null };
  }

  const command = new StartIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
    description: 'Auto-sync after document processing'
  });

  const result = await bedrockAgentClient.send(command);
  return {
    ingestionJobId: result.ingestionJob?.ingestionJobId,
    status: result.ingestionJob?.status
  };
}

/**
 * Get all Textract results with pagination support
 */
async function getAllTextractResults(jobId, operationType) {
  const allBlocks = [];
  let nextToken = null;
  let pageCount = 0;

  do {
    console.log(`Fetching Textract results page ${pageCount + 1}${nextToken ? ` (NextToken: ${nextToken.substring(0, 20)}...)` : ''}`);
    
    let command;
    if (operationType === 'ANALYSIS') {
      command = new GetDocumentAnalysisCommand({ 
        JobId: jobId,
        NextToken: nextToken
      });
    } else {
      command = new GetDocumentTextDetectionCommand({ 
        JobId: jobId,
        NextToken: nextToken
      });
    }

    const result = await textractClient.send(command);
    
    if (result.JobStatus !== 'SUCCEEDED') {
      throw new Error(`Textract job failed with status: ${result.JobStatus}`);
    }

    // Add blocks from this page
    if (result.Blocks && result.Blocks.length > 0) {
      allBlocks.push(...result.Blocks);
      console.log(`Added ${result.Blocks.length} blocks from page ${pageCount + 1}`);
    }

    // Check for more pages
    nextToken = result.NextToken;
    pageCount++;

    // Safety check to prevent infinite loops
    if (pageCount > 1000) {
      console.warn('Reached maximum page limit (1000), stopping pagination');
      break;
    }

  } while (nextToken);

  console.log(`Completed pagination: ${pageCount} pages, ${allBlocks.length} total blocks`);
  return allBlocks;
}

/**
 * Process text detection results (simple text extraction) - optimized for large documents
 */
function processTextDetection(blocks) {
  if (!blocks || blocks.length === 0) return { text: '', pageCount: 0, wordCount: 0, hasStructuredData: false };

  console.log(`Processing ${blocks.length} blocks for text detection`);

  // Filter LINE blocks first to reduce processing load
  const lineBlocks = blocks.filter(block => block.BlockType === 'LINE');
  console.log(`Found ${lineBlocks.length} LINE blocks`);

  // Sort in chunks to avoid stack overflow with large arrays
  const sortedLines = sortBlocksInChunks(lineBlocks);
  
  // Extract text efficiently
  const textLines = [];
  for (const block of sortedLines) {
    if (block.Text && block.Text.trim().length > 0) {
      textLines.push(block.Text);
    }
  }

  const text = textLines.join('\n');
  
  // Calculate page count safely without spread operator
  let maxPage = 1;
  for (const block of blocks) {
    if (block.Page && block.Page > maxPage) {
      maxPage = block.Page;
    }
  }
  
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate average confidence efficiently
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const block of blocks) {
    if (block.Confidence) {
      totalConfidence += block.Confidence;
      confidenceCount++;
    }
  }
  const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  console.log(`Processed text: ${text.length} characters, ${maxPage} pages, ${wordCount} words`);

  return {
    text,
    pageCount: maxPage,
    wordCount,
    hasStructuredData: false,
    averageConfidence,
    structuredData: null
  };
}

/**
 * Sort blocks in chunks to avoid stack overflow with large arrays
 */
function sortBlocksInChunks(blocks) {
  const CHUNK_SIZE = 1000; // Process 1000 blocks at a time
  const sortedBlocks = [];
  
  // Sort in chunks
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);
    const sortedChunk = chunk.sort((a, b) => {
      // Sort by page, then by top position, then by left position
      if (a.Page !== b.Page) return a.Page - b.Page;
      if (Math.abs(a.Geometry.BoundingBox.Top - b.Geometry.BoundingBox.Top) > 0.01) {
        return a.Geometry.BoundingBox.Top - b.Geometry.BoundingBox.Top;
      }
      return a.Geometry.BoundingBox.Left - b.Geometry.BoundingBox.Left;
    });
    sortedBlocks.push(...sortedChunk);
  }
  
  // Final sort of chunks (smaller arrays, safer)
  return sortedBlocks.sort((a, b) => {
    if (a.Page !== b.Page) return a.Page - b.Page;
    if (Math.abs(a.Geometry.BoundingBox.Top - b.Geometry.BoundingBox.Top) > 0.01) {
      return a.Geometry.BoundingBox.Top - b.Geometry.BoundingBox.Top;
    }
    return a.Geometry.BoundingBox.Left - b.Geometry.BoundingBox.Left;
  });
}

/**
 * Process document analysis results (includes tables and forms) - optimized for large documents
 */
function processDocumentAnalysis(blocks) {
  if (!blocks || blocks.length === 0) return { text: '', pageCount: 0, wordCount: 0, hasStructuredData: false };

  console.log(`Processing ${blocks.length} blocks for document analysis`);

  // Filter LINE blocks first to reduce processing load
  const lineBlocks = blocks.filter(block => block.BlockType === 'LINE');
  console.log(`Found ${lineBlocks.length} LINE blocks`);

  // Sort in chunks to avoid stack overflow
  const sortedLines = sortBlocksInChunks(lineBlocks);
  
  // Extract text efficiently
  const textLines = [];
  for (const block of sortedLines) {
    if (block.Text && block.Text.trim().length > 0) {
      textLines.push(block.Text);
    }
  }

  // Extract structured data (tables and forms) - limit processing for very large docs
  const tables = blocks.length > 10000 ? [] : extractTables(blocks);
  const forms = blocks.length > 10000 ? [] : extractForms(blocks);
  
  const text = textLines.join('\n');
  
  // Calculate page count safely
  let maxPage = 1;
  for (const block of blocks) {
    if (block.Page && block.Page > maxPage) {
      maxPage = block.Page;
    }
  }
  
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const hasStructuredData = tables.length > 0 || forms.length > 0;
  
  // Calculate average confidence efficiently
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const block of blocks) {
    if (block.Confidence) {
      totalConfidence += block.Confidence;
      confidenceCount++;
    }
  }
  const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  console.log(`Processed analysis: ${text.length} characters, ${maxPage} pages, ${wordCount} words, ${tables.length} tables, ${forms.length} forms`);

  return {
    text,
    pageCount: maxPage,
    wordCount,
    hasStructuredData,
    averageConfidence,
    structuredData: {
      tables,
      forms
    }
  };
}

/**
 * Extract table data from Textract blocks
 */
function extractTables(blocks) {
  const tables = [];
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
  
  for (const tableBlock of tableBlocks) {
    const table = {
      page: tableBlock.Page,
      confidence: tableBlock.Confidence,
      rows: []
    };
    
    // This is a simplified table extraction
    // In a production system, you'd want more sophisticated table parsing
    if (tableBlock.Relationships) {
      const cellIds = tableBlock.Relationships
        .find(rel => rel.Type === 'CHILD')?.Ids || [];
      
      const cells = blocks.filter(block => 
        cellIds.includes(block.Id) && block.BlockType === 'CELL'
      );
      
      // Group cells by row
      const rowMap = {};
      cells.forEach(cell => {
        const rowIndex = cell.RowIndex || 0;
        if (!rowMap[rowIndex]) rowMap[rowIndex] = [];
        rowMap[rowIndex].push({
          columnIndex: cell.ColumnIndex || 0,
          text: cell.Text || '',
          confidence: cell.Confidence
        });
      });
      
      // Convert to array and sort
      table.rows = Object.keys(rowMap)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(rowIndex => 
          rowMap[rowIndex].sort((a, b) => a.columnIndex - b.columnIndex)
        );
    }
    
    tables.push(table);
  }
  
  return tables;
}

/**
 * Extract form data from Textract blocks
 */
function extractForms(blocks) {
  const forms = [];
  const keyValueBlocks = blocks.filter(block => 
    block.BlockType === 'KEY_VALUE_SET'
  );
  
  const keyBlocks = keyValueBlocks.filter(block => 
    block.EntityTypes && block.EntityTypes.includes('KEY')
  );
  
  for (const keyBlock of keyBlocks) {
    if (keyBlock.Relationships) {
      const valueRelation = keyBlock.Relationships.find(rel => rel.Type === 'VALUE');
      if (valueRelation && valueRelation.Ids) {
        const valueBlock = blocks.find(block => 
          valueRelation.Ids.includes(block.Id)
        );
        
        if (valueBlock) {
          forms.push({
            key: keyBlock.Text || '',
            value: valueBlock.Text || '',
            keyConfidence: keyBlock.Confidence,
            valueConfidence: valueBlock.Confidence,
            page: keyBlock.Page
          });
        }
      }
    }
  }
  
  return forms;
}