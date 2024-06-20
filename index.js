import express, { query } from 'express'
const app = express()
const port = 4001
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { CharacterTextSplitter } from "@langchain/textsplitters";
// app.use(express.json());
// app.use(cookieParser());

import * as fs from "fs/promises";
import {
  Gemini,
  Document,
  VectorStoreIndex,
  Settings,
  GEMINI_MODEL,
  GeminiEmbedding,
  GEMINI_EMBEDDING_MODEL,
} from "llamaindex";


// setting up DB/Connection
const url = "mongodb+srv://HemanthGirimath:bJhz4zkEnXDoKvVI@geminiragllm.oe9topz.mongodb.net/?retryWrites=true&w=majority&appName=GeminiRagLlm"
const Client  = new MongoClient(url);

async function ConnectToMongoDb(){
  try {
    await Client.connect();
    console.log("Successfully connected to Atlas");
    main();

    } catch (err) {
        console.log(err.stack);
    }
    finally {
        await Client.close();
}

}
Settings.llm = new Gemini({
  model: GEMINI_MODEL.GEMINI_PRO_LATEST,
  apiKey: process.env.GOOGLE_API_KEY,
});
Settings.embedModel = new GeminiEmbedding({
  model:GEMINI_EMBEDDING_MODEL.TEXT_EMBEDDING_004
});

async function main() {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    throw new Error('Set Google API Key in GOOGLE_API_KEY env variable');
  }
//load datat fron node
  const path = "node_modules/llamaindex/examples/abramov.txt";
  const essay = await fs.readFile(path, "utf-8");
//create document object with essay
const document = new Document({ text: essay, id_: path});
const index = await VectorStoreIndex.fromDocuments([document]);
await Client.connect();
const db = Client.db("langchain_db");
const col = db.collection("VectorStore");
// const insertData = col.insertOne(index)
// console.log("inserted the data")
// const retiver = index.asRetriever();
// retiver.topK = 6;
// console.log("reterivers relavent info",retiver)
// const queryEngine = index.asQueryEngine({retiver});
// const  response  = await queryEngine.query({query: "when was the first job for the author and what was the salary?"})
const embedding = new GeminiEmbedding();
const embeddingResponse = await embedding.getTextEmbedding("when was authors first job?")

console.log(embeddingResponse)
QueryMongdb(embeddingResponse)
}



async function QueryMongdb(queryText) {
    try {
        const database = Client.db("langchain_db");
        const coll = database.collection("VectorStore");
        // define pipeline
        const agg = [
            {
              '$vectorSearch': {
                'index': 'vector_index', 
                'path': 'embeddings', 
                'queryVector': queryText, 
                'numCandidates': 150, 
                'limit': 10
              }
            }, {
              '$project': {
                '_id': 0, 
                'plot': 1, 
                'title': 1, 
                'score': {
                  '$meta': 'vectorSearchScore'
                }
              }
            }
          ];
        // run pipeline
        const result = coll.aggregate(agg);

        // print results
      //  await result.forEach((doc) => console.dir(JSON.stringify(doc)));
      console.log(result)

    } 
    catch(error){
      console.log(error)
    }
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
