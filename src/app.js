const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, op } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * Returns a contract by id that belongs to the user
 * @param {id}
 * @example GET: /contracts/123
 * @returns the contract
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const { id } = req.params;
    const profileId = req.profile.id;

    // getting the contract
    const contract = await Contract.findOne({
        where: { id, [op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    if (!contract)
        return res.status(404).json({ error: `Any contract was found for the provided 'id'` });

    res.json(contract);
});

/**
 * Returns a list of contracts that belongs to the user
 * @example GET: /contracts
 * @returns a list of contracts
 */
app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    const profileId = req.profile.id;

    // getting the contracts
    const contracts = await Contract.findAll({
        where: { status: { [op.ne]: 'terminated' }, [op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    res.json(contracts);
});

/**
 * Returns all unpaid jobs that belongs to the user
 * @example GET: /jobs/unpaid
 * @returns a list of jobs
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { Job, Contract } = req.app.get('models');
    const profileId = req.profile.id;

    // getting the jobs
    const jobs = await Job.findAll({
        where: {
            paid: null,
            '$Contract.status$': { [op.ne]: 'terminated' },
            [op.or]: [{ '$Contract.ContractorId$': profileId }, { '$Contract.ClientId$': profileId }]
        },
        include: [{ model: Contract, required: true }]
    });

    res.json(jobs);
});

/**
 * Realizes the payment of a job
 * @param {jobId}
 * @example POST: /jobs/123/pay
 * @returns the confirmation message
 */
app.post('/jobs/:jobId/pay', getProfile, async (req, res) => {
    const { Job, Contract, Profile } = req.app.get('models');
    const { jobId } = req.params;
    const profileId = req.profile.id;

    // starting a new transaction
    const transaction = await sequelize.transaction();

    // getting the job
    const job = await Job.findOne({
        where: {
            id: jobId,
            paid: null,
            '$Contract.ClientId$': profileId
        },
        include: [{ model: Contract, required: true }],
        lock: true,
        transaction
    });
    if (!job) {
        await transaction.rollback();
        return res.status(404).json({ error: `The job was not found or has already been paid` });
    }

    const amountToPay = job.price;

    // getting the client
    const client = await Profile.findOne({ where: { id: job.Contract.ClientId }, lock: true, transaction });

    // checking the balance
    if (client.balance < amountToPay) {
        await transaction.rollback();
        return res.status(400).json({ error: `Client has not enough balance for the transaction` });
    }

    // updating tables
    await Profile.increment({ balance: -amountToPay }, { where: { id: client.id }, lock: true, transaction });
    await Profile.increment({ balance: +amountToPay }, { where: { id: job.Contract.ContractorId }, lock: true, transaction });
    await Job.update({ paid: 1, paymentDate: new Date() }, { where: { id: jobId }, lock: true, transaction });

    // finishing transaction
    await transaction.commit();

    res.json({ message: "Payment concluded" });
});

/**
 * Realizes a deposit at the user profile balance
 * @param {userId}
 * @param {depositValue}
 * @example POST: /balances/deposit/123/amount/456
 * @returns the confirmation message
 */
app.post('/balances/deposit/:userId/amount/:depositValue', getProfile, async (req, res) => {
    const { Job, Contract, Profile } = req.app.get('models');
    const { userId, depositValue } = req.params;
    const profileId = req.profile.id;

    // verifying if the user of authentication is the same to deposit
    if (userId !== profileId.toString())
        return res.status(400).json({ error: `Deposits for other users are not possible` });

    // starting a new transaction
    const transaction = await sequelize.transaction();

    // getting the jobs
    const jobs = await Job.findAll({
        where: {
            paid: null,
            [op.or]: [{ '$Contract.ContractorId$': profileId }, { '$Contract.ClientId$': profileId }]
        },
        include: [{ model: Contract, required: true }],
        lock: true, transaction
    });

    const amountOfJobsToPay = jobs.reduce((accumulator, object) => accumulator + object.price, 0);
    const limitAmountToPayPercentage = amountOfJobsToPay * 0.25;

    if (depositValue > limitAmountToPayPercentage) {
        await transaction.rollback();
        return res.status(400).json({ error: `It is not possible to deposit more thant 25% of the amount to pay` });
    }

    await Profile.increment({ balance: +depositValue }, { where: { id: profileId }, lock: true, transaction });

    // finishing transaction
    await transaction.commit();

    res.json({ message: "Deposit concluded" });
});

/**
 * Returns the profession that earned the most money in the query time period requested
 * @param {start}
 * @param {end}
 * @example GET: /admin/best-profession?start=2019-02-16&end=2024-02-16
 * @returns the profession
 */
app.get('/admin/best-profession', getProfile, async (req, res) => {
    const { Job, Contract, Profile } = req.app.get('models');
    const { start, end } = req.query;

    // getting the best profession
    const result = await Job.findOne({
        attributes: [
            [sequelize.col('Contract.Contractor.profession'), 'bestProfession'],
        ],
        include: [
            {
                model: Contract,
                attributes: [],
                required: true,
                include: [
                    {
                        model: Profile,
                        as: 'Contractor',
                        attributes: [],
                        required: true
                    }
                ]
            }
        ],
        where: {
            paid: 1,
            paymentDate: {
                [op.between]: [new Date(start), new Date(end)],
            }
        },
        group: ['Contract.ContractorId'],
        order: [[sequelize.fn('SUM', sequelize.col('price')), 'DESC']]
    });
    if (!result)
        return res.status(404).json({ error: `Any data was found for the provided period` });

    res.json(result);
});

/**
 * Returns the clients that paid the most for jobs in the query time period requested
 * @param {start}
 * @param {end}
 * @param {limit}
 * @example GET: /admin/best-clients?start=2019-02-16&end=2024-02-16&limit=2
 * @returns the list of clients
 */
app.get('/admin/best-clients', getProfile, async (req, res) => {
    const { Job, Contract, Profile } = req.app.get('models');
    const { start, end, limit } = req.query;

    const result = await Job.findAll({
        attributes: [
            [sequelize.literal('Contract.ClientId'), 'id'],
            [sequelize.fn('CONCAT', sequelize.col('Contract.Client.firstName'), ' ', sequelize.col('Contract.Client.lastName')), 'fullName'],
            [sequelize.fn('SUM', sequelize.col('price')), 'paid'],
        ],
        include: [
            {
                model: Contract,
                attributes: [],
                required: true,
                include: [
                    {
                        model: Profile,
                        as: 'Client',
                        attributes: [],
                        required: true
                    }
                ]
            }
        ],
        where: {
            paid: 1,
            paymentDate: {
                [op.between]: [new Date(start), new Date(end)],
            }
        },
        group: ['Contract.ClientId'],
        order: [[sequelize.literal('paid'), 'DESC']],
        limit: limit ?? 2
    });

    res.json(result);
});

module.exports = app;
