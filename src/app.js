const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, op } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * @returns contract by id
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
 * @returns a list of contracts belonging to a user
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
 * @returns all unpaid jobs for a user
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
 * @returns Pay for a job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { Job, Contract, Profile } = req.app.get('models');
    const { job_id } = req.params;
    const profileId = req.profile.id;

    // starting a new transaction
    const transaction = await sequelize.transaction();

    // getting the job
    const job = await Job.findOne({
        where: {
            id: job_id,
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
    await Job.update({ paid: 1, paymentDate: new Date() }, { where: { id: job_id }, lock: true, transaction });

    // finishing transaction
    await transaction.commit();

    res.json({ message: "Payment concluded" });
});

/**
 * @returns ...
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
 * @returns ...
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
 * @returns ...
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
