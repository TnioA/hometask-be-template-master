const request = require("supertest");
const app = require("../app");
const { Profile, Contract, Job } = require("../mocks/model.mock");

// jest.mock('../model', () => {
//     return require('../mocks/model.mock');
// });

jest.mock('../model');
const { sequelize, op } = require('../model');
sequelize.models = {
    Profile, Contract, Job
};


// #region GetContractById

test("GetContractById_Returns_Non_Authenticated", async () => {
    // arrange
    Profile.$queryInterface.$useHandler((query, queryOptions, done) => {
        if (query === 'findOne') return null;
    });
    
    // action
    const response = await request(app).get("/contracts/123");

    // assert
    expect(response.statusCode).toBe(401);
});

test("GetContractById_Returns_Non_Authenticated", async () => {
    // arrange

    // action
    const response = await request(app).get("/contracts/123");

    // assert
    expect(response.statusCode).toBe(404);
});

// test("GetContractById_Returns_401", async () => {
//     const response = await request(app).get("/contracts/123");

//     console.log("ESTE BODY É: ");
//     console.log(response.body);
//     expect(response.statusCode).toBe(401);
// });

// #endregion