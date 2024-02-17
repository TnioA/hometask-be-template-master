/* Swagger configuration */
const options = {
    openapi: 'OpenAPI 3',   // Enable/Disable OpenAPI. By default is null
    language: 'en-US',      // Change response language. By default is 'en-US'
    disableLogs: false,     // Enable/Disable logs. By default is false
    autoHeaders: false,     // Enable/Disable automatic headers capture. By default is true
    autoQuery: false,       // Enable/Disable automatic query capture. By default is true
    autoBody: false         // Enable/Disable automatic body capture. By default is true
}

// const config = require('../config/cloud');
const swaggerAutogen = require('swagger-autogen')();
// const msg = require('../utils/lang/messages');

const doc = {
    info: {
        version: '2.0.0',      // by default: '1.0.0'
        title: 'Deel Backend task API',        // by default: 'REST API'
        description: 'This backend exercise involves building a Node.js/Express.js app that will serve a REST API. We imagine you should spend around 3 hours at implement this feature.',  // by default: ''
        contact: {
            'name': 'Tanio Rocha',
            'email': 'hortanio@gmail.com'
        },
    },
    host: 'localhost:3001',      // by default: 'localhost:3000'
    basePath: '/',  // by default: '/'
    schemes: ['http'],   // by default: ['http']
    consumes: ['application/json'],  // by default: ['application/json']
    produces: ['application/json'],  // by default: ['application/json']
    // tags: [        // by default: empty Array
    //     {
    //         name: 'Queue CRUD',         // Tag name
    //         description: 'Queue related apis',  // Tag description
    //     },
    //     {
    //         name: 'Health',
    //         description: 'Health Check'
    //     }
    // ],
    securityDefinitions: {
        apiKeyAuth: {
            type: 'apiKey',
            in: 'header', // can be 'header', 'query' or 'cookie'
            name: 'profile_id', // name of the header, query parameter or cookie
            description: 'Add your profile_id to authenticate'
        }
    },
    definitions: {
        helathResponse: {
            code: '200',
            message: 'Success',
        },
        'errorResponse.400': {
            code: '400',
            message: 'Bad Request',
        },
        'errorResponse.401': {
            code: '401',
            message: 'Unauthorized',
        },
        'errorResponse.404': {
            "code": "404",
            "message": "Not found",
        },
        'errorResponse.500': {
            code: '500',
            message: 'Exception',
        }
    },          // by default: empty object (Swagger 2.0)
};

const outputFile = './docs/swagger.json';
const endpointsFiles = ['./src/app.js', './controllers/*.js'];

/* NOTE: if you use the express Router, you must pass in the 
   'endpointsFiles' only the root file where the route starts,
   such as: index.js, app.js, routes.js, ... */
swaggerAutogen(outputFile, endpointsFiles, doc);

// swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
//     require('./index.js'); // Your project's root file
//   });