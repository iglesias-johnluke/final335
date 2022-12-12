const e = require("express");
const { response } = require("express");
const {MongoClient, ServerApiVersion} = require('mongodb')
const path = require("path");
const express = require("express");   /* Accessing express module */
const app = express();  /* app is a request handler function */
const bodyParser = require("body-parser");
const { countReset } = require("console");

const CREDENTIALS_FOLDER_NAME = "credentials"
//enable access to environment variables from .env file
require("dotenv").config({ path: path.resolve(__dirname, `${CREDENTIALS_FOLDER_NAME}/.env`) }) 

const mongoURI = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.62m9rws.mongodb.net/?retryWrites=true&w=majority`
const mongoClient = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function connectToMongo(){
    await mongoClient.connect();

}

async function runServer(){
    const portNumber = 3000
    console.log("mongoURI", mongoURI)
    setEJSEngine()
    showHomePage("usa")
    showUserStatsPage()
    setCountryStatsPostEndpoint()
    userStatsPost()
    
    

    app.listen(portNumber);
}

async function addDiagnosesToDB(count){

    try {
        
        /* Inserting */
        console.log("INSERTING");
        let targetName = "diagnoses"
        let originalCount = parseInt( (await getUserDiagnoses())[0].diagnoses )
        let newCount = originalCount + count

        let newValues = {diagnoses: newCount}
        await updateOne(mongoClient, targetName, newValues)
        

    } catch (e) {
        console.error(e);
    } 

}

async function updateOne(client, targetName, newValues) {
    let filter = {name : targetName};
    let update = { $set: newValues };

    const result = await client.db(process.env.MONGO_DB_NAME)
    .collection(process.env.MONGO_COLLECTION)
    .updateOne(filter, update);

    console.log(`Documents modified: ${result.modifiedCount}`);
}


function userStatsPost(){
    app.post("/userStats", async (request, response) => {
		/* Generating the HTML */
        let count = parseInt(request.body.occurences)
        await addDiagnosesToDB(count)

        let diagnosedCount = (await getUserDiagnoses())[0].diagnoses
        let variables = {diagnosed: diagnosedCount}
		response.render("userStats", variables);
	  });
}

function showUserStatsPage(){
    app.get("/userStats", async (request, response) => {
		/* Generating the HTML */
        let diagnosedCount = (await getUserDiagnoses())[0].diagnoses

        let variables = {diagnosed: diagnosedCount}
		response.render("userStats", variables);
	  });
}


async function getUserDiagnoses(){
    const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
	let result = null
    try {       
        /* fetching 1 student */
        console.log("fetching user diagnoses");
        let filter = {}
		result = await client.db(process.env.MONGO_DB_NAME)
							.collection(process.env.MONGO_COLLECTION)
                            .find(filter).toArray()
                            
		console.log(`fetched: ${result}`)
		
    } catch (e) {
        console.error(e);
		
    } 
	return result
	

}


function showHomePage(countryString){
    const request = require('request');

    const options = {
        method: 'GET',
        url: 'https://covid-193.p.rapidapi.com/statistics',
        qs: {country: countryString},
        headers: {
          'X-RapidAPI-Key': '592335e039mshb9b920d9c3f8866p183755jsncc14cd4e3094',
          'X-RapidAPI-Host': 'covid-193.p.rapidapi.com',
          useQueryString: true
        }
      };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        let bodyObj = JSON.parse(body)
        let currentCases = bodyObj.response[0]["cases"]

        console.log(currentCases);
        let variables = {active: currentCases["active"], recovered: currentCases["recovered"], 
            critical: currentCases["critical"]
        }
        setGetEndpoint("home", "/", variables)
        
    });
}

function showCountryStatsPage(postRequest, postResponse){
    const request = require('request');

    const options = {
        method: 'GET',
        url: 'https://covid-193.p.rapidapi.com/statistics',
        qs: {country: postRequest.body.country},
        headers: {
          'X-RapidAPI-Key': '592335e039mshb9b920d9c3f8866p183755jsncc14cd4e3094',
          'X-RapidAPI-Host': 'covid-193.p.rapidapi.com',
          useQueryString: true
        }
      };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        try{//country exists
            let bodyObj = JSON.parse(body)
            let currentCases = bodyObj.response[0]["cases"]
            let queriedCountry = bodyObj.response[0]["country"]
    
            let variables = {country: queriedCountry, critical:currentCases["critical"],
                            active: currentCases["active"], recovered: currentCases["recovered"]}
            postResponse.render("countryStats", variables)
            console.log(currentCases);
        }catch{//country DNE
            let variables = {country: "country not found", critical:"country not found",
                            active: "country not found", recovered: "country not found"}
            postResponse.render("countryStats", variables)
        }
        
    });

}

function setCountryStatsPostEndpoint(){
    app.post("/", (request, response) => {
		/* Generating the HTML */
		showCountryStatsPage(request, response)
	  });

}

/**sets get endpoint at path using ejs file (w/o .ejs) given dictionary of variables*/
function setGetEndpoint(ejsFileName, path, variables){
    
	app.get(path, (request, response) => {
		/* Generating the HTML */
		response.render(ejsFileName, variables);
	  });
}

function setAllEndpoints(){
    setGetEndpoint("home", "/", {})
}

/**accepts port number at command line from user, returns it */
function getCommandLinePortNumber(){
    process.stdin.setEncoding("utf8");

	//exit if server run with not 3 arguments at commandline
	if (process.argv.length != 3) {
		process.stdout.write(`Usage myServer.js portNumber`);
		process.exit(0);
	}

	portNumber = parseInt(process.argv[2]) 

    return portNumber

}

function setEJSEngine(){
    /* directory where templates will reside */
	app.set("views", path.resolve(__dirname, "templates"));
	/* view/templating engine */
	app.set("view engine", "ejs");
	app.use(bodyParser.urlencoded({extended:false}));

}

connectToMongo()
runServer()
