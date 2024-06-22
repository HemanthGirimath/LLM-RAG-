import express, { query } from 'express'
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { MongoDBAtlasVectorSearch} from "@langchain/mongodb";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import * as fs from "fs/promises";
import {Gemini,Settings,GEMINI_MODEL,GeminiEmbedding,GEMINI_EMBEDDING_MODEL} from "llamaindex";
import { GoogleGenerativeAIEmbeddings,ChatGoogleGenerativeAI } from "@langchain/google-genai";
  const app = express()
  const port = 4001
// setting up DB/Connection
const url = "mongodb+srv://HemanthGirimath:bJhz4zkEnXDoKvVI@geminiragllm.oe9topz.mongodb.net/?retryWrites=true&w=majority&appName=GeminiRagLlm"
const Client  = new MongoClient(url);
let vectoreStore 

async function ConnectToMongoDb(){
  try {
    await Client.connect();
    console.log("Successfully connected to Atlas");
    run()

    } catch (err) {
        console.log(err.stack);
    }
}
Settings.llm = new Gemini({
  model: GEMINI_MODEL.GEMINI_PRO_LATEST,
  apiKey: process.env.GOOGLE_API_KEY,
});
Settings.embedModel = new GeminiEmbedding({
  model:GEMINI_EMBEDDING_MODEL.TEXT_EMBEDDING_004
});

async function run(){
  await Client.connect();
  try{
    const database = Client.db("langchain_db");
    const collection = database.collection("test");
    const dbConfig = {  
      collection: collection,
      indexName: "vector_index",
      textKey: "text", 
      embeddingKey: "embedding",
    };
    await collection.deleteMany({});
  const path = "node_modules/llamaindex/examples/abramov.txt"
  const eassay = await fs.readFile(path,'utf-8')
  const textsplitters = new RecursiveCharacterTextSplitter({
    separators:"\n\n",
    chunkSize:1000,
    chunkOverlap:200,
  });
  const docs = await textsplitters.createDocuments([eassay]);
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "embedding-001", // 768 dimensions
   apiKey:process.env.GOOGLE_API_KEY
  });
  vectoreStore = await MongoDBAtlasVectorSearch.fromDocuments(docs,embeddings,dbConfig);
  QueryMongo();
  }
  catch(error){
    console.log(error)
  }
  console.log("Waiting for initial sync...");
  await new Promise(resolve => setTimeout(() => {
  resolve();
}, 10000));
}

async function QueryMongo(){
  if (!vectoreStore) {
    console.error("Vector store is not initialized. Run the initialization function first.");
    return;
  }
  const retriver = vectoreStore.asRetriever();
  const prompt =
  PromptTemplate.fromTemplate(`Answer the question based on the following context:
  {context}
  Question: {question}`);
const model = new ChatGoogleGenerativeAI({
  apiKey:process.env.GOOGLE_API_KEY,
  model:"gemini-pro"
});
const chain = RunnableSequence.from([
  {
    context: retriver.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);
const question = "what was the authors sakary on his first job";  
const answer = await chain.invoke(question);
console.log("Question: " + question);
console.log("Answer: " + answer);

const retrievedResults = await retriver.getRelevantDocuments(question);
const documents = retrievedResults.map((documents => ({
  pageContent: documents.pageContent,
})))
console.log("\nSource documents:\n" + JSON.stringify(documents, 1, 2))

}

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Trying another port...`);
    const newPort = port + 1;
    app.listen(newPort, () => {
      console.log(`Server is now running on port ${newPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
})

ConnectToMongoDb();
