const request = require("supertest");
const app = require("../app");
const { sequelize } = require('../model');
const { getProfile } = require('../middleware/getProfile');

// Global Mocks

jest.mock('../model');
jest.mock('../middleware/getProfile');

const mockTransaction = jest.fn().mockResolvedValue({ rollback: () => null, commit: () => null });
sequelize.transaction = mockTransaction;

getProfile.mockImplementation((req, res, next) => {
    req.profile = { id: 1 };
    next();
});

// Api mocks

describe('GET /contracts/:id', () => {
    it('should Return error', async () => {
        // Arrange
        const findOneMock = jest.fn().mockResolvedValue(null);
        sequelize.models.Contract.findOne = findOneMock;

        // Action
        const response = await request(app).get('/contracts/1');

        // Assert
        expect(response.status).toBe(404);
    });

    it('should Return a contract by id', async () => {
        // Arrange
        const mockedContract = {
            id: 1,
            terms: 'bla bla bla',
            status: 'in_progress',
            ClientId: 1,
            ContractorId: 1
        };
        const findOneMock = jest.fn().mockResolvedValue(mockedContract);
        sequelize.models.Contract.findOne = findOneMock;

        // Action
        const response = await request(app).get('/contracts/1');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockedContract);
    });
});

describe('GET /contracts', () => {
    it('should return a list of contracts', async () => {
        // Arrange
        const mockedContracts = [{
            id: 1,
            terms: 'bla bla bla',
            status: 'in_progress',
            ClientId: 1,
            ContractorId: 1
        }];
        const findAllMock = jest.fn().mockResolvedValue(mockedContracts);
        sequelize.models.Contract.findAll = findAllMock;

        // Action
        const response = await request(app).get('/contracts');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockedContracts);
    });
});

describe('GET /jobs/unpaid', () => {
    it('should return a list of unpaid jobs', async () => {
        // Arrange
        const mockedJobs = [{
            id: 1,
            description: 'Luiz',
            price: 32,
            paid: true,
            paymentDate: '2020-08-14T23:11:26.737Z',
            Contractid: 1
        }];
        const findAllMock = jest.fn().mockResolvedValue(mockedJobs);
        sequelize.models.Job.findAll = findAllMock;

        // Action
        const response = await request(app).get('/jobs/unpaid');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockedJobs);
    });
});

describe('POST /jobs/:jobId/pay', () => {
    it('should return error because job was not found', async () => {
        // Arrange
        const findOneMock = jest.fn().mockResolvedValue(null);
        sequelize.models.Job.findOne = findOneMock;

        // Action
        const response = await request(app).post('/jobs/1/pay');

        // Assert
        expect(response.status).toBe(404);
    });

    it('should return error because client does not have balance', async () => {
        // Arrange
        const mockedJob = {
            id: 1,
            description: 'Luiz',
            price: 32,
            paid: true,
            paymentDate: '2020-08-14T23:11:26.737Z',
            Contractid: 1,
            Contract: {
                ClientId: 1
            }
        };
        sequelize.models.Job.findOne = jest.fn().mockResolvedValue(mockedJob);

        const mockedProfile = {
            id: 1,
            firstName: 'Ayrton',
            lastName: 'Senna',
            profession: 'driver',
            balance: 25.3,
            type: 'client'
        };
        sequelize.models.Profile.findOne = jest.fn().mockResolvedValue(mockedProfile);

        // Action
        const response = await request(app).post('/jobs/1/pay');

        // Assert
        expect(response.status).toBe(400);
    });

    it('should realize the payment of a job', async () => {
        // Arrange
        const mockedJob = {
            id: 1,
            description: 'Luiz',
            price: 32,
            paid: true,
            paymentDate: '2020-08-14T23:11:26.737Z',
            Contractid: 1,
            Contract: {
                ClientId: 1
            }
        };
        sequelize.models.Job.findOne = jest.fn().mockResolvedValue(mockedJob);
        sequelize.models.Job.update = jest.fn().mockResolvedValue(null);

        const mockedProfile = {
            id: 1,
            firstName: 'Ayrton',
            lastName: 'Senna',
            profession: 'driver',
            balance: 35,
            type: 'client'
        };
        sequelize.models.Profile.findOne = jest.fn().mockResolvedValue(mockedProfile);
        sequelize.models.Profile.increment = jest.fn().mockResolvedValue(null);

        // Action
        const response = await request(app).post('/jobs/1/pay');

        // Assert
        expect(response.status).toBe(200);
    });
});

describe('POST /balances/deposit/:userId/amount/:depositValue', () => {
    it('should return error because user is not the same of auth', async () => {
        // Action
        const response = await request(app).post('/balances/deposit/2/amount/100');

        // Assert
        expect(response.status).toBe(400);
    });

    it('should return error because deposit value is bigger than 25% of jobs amount', async () => {
        // Arrange
        const mockedJobs = [{
            id: 1,
            description: 'Luiz',
            price: 32,
            paid: true,
            paymentDate: '2020-08-14T23:11:26.737Z',
            Contractid: 1
        }];
        const findAllMock = jest.fn().mockResolvedValue(mockedJobs);
        sequelize.models.Job.findAll = findAllMock;
        sequelize.models.Profile.increment = jest.fn().mockResolvedValue(null);

        // Action
        const response = await request(app).post('/balances/deposit/1/amount/100');

        // Assert
        expect(response.status).toBe(400);
    });

    it('should realize a deposit at the profile balance', async () => {
        // Arrange
        const mockedJobs = [{
            id: 1,
            description: 'Luiz',
            price: 1000,
            paid: true,
            paymentDate: '2020-08-14T23:11:26.737Z',
            Contractid: 1
        }];
        const findAllMock = jest.fn().mockResolvedValue(mockedJobs);
        sequelize.models.Job.findAll = findAllMock;
        sequelize.models.Profile.increment = jest.fn().mockResolvedValue(null);

        // Action
        const response = await request(app).post('/balances/deposit/1/amount/100');

        // Assert
        expect(response.status).toBe(200);
    });
});

describe('GET /admin/best-profession', () => {
    it('should return error because could not find the best profession', async () => {
        // Arrange
        const findOneMock = jest.fn().mockResolvedValue(null);
        sequelize.models.Job.findOne = findOneMock;

        // Action
        const response = await request(app).get('/admin/best-profession?start=2019-02-16&end=2024-02-16');

        // Assert
        expect(response.status).toBe(404);
    });

    it('should return the profession that earned the most money', async () => {
        // Arrange
        const mockedResult = {
            bestProfession: "programmer"
        };
        const findOneMock = jest.fn().mockResolvedValue(mockedResult);
        sequelize.models.Job.findOne = findOneMock;

        // Action
        const response = await request(app).get('/admin/best-profession?start=2019-02-16&end=2024-02-16');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.bestProfession).toEqual("programmer");
    });
});

describe('GET /admin/best-clients', () => {
    it('should return the clients that paid the most for jobs', async () => {
        // Arrange
        const mockedResult = [
            {
                id: 1,
                fullName: "Reece Moyer",
                paid: 100.3
            }
        ];
        const findAllMock = jest.fn().mockResolvedValue(mockedResult);
        sequelize.models.Job.findAll = findAllMock;

        // Action
        const response = await request(app).get('/admin/best-clients?start=2019-02-16&end=2024-02-16&limit=4');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockedResult);
    });
});