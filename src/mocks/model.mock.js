const SequelizeMock = require('sequelize-mock');
const dbMock = new SequelizeMock();

const ProfileMock = dbMock.define('Profile', {
    id: 1,
    firstName: 'Ayrton',
    lastName: 'Senna',
    profession: 'driver',
    balance: 25.3,
    type: 'client'
});

const ContractMock = dbMock.define('Contract', {
    id: 1,
    terms: 'bla bla bla',
    status: 'in_progress',
    ClientId: 1,
    ContractorId: 1
});

const JobMock = dbMock.define('Job', {
    id: 1,
    description: 'Luiz',
    price: 32,
    paid: true,
    paymentDate: '2020-08-14T23:11:26.737Z',
    Contractid: 1
});

// ProfileMock.$queryInterface.$useHandler((query, queryOptions, done) => {
//     console.log("bosta");
//     if (query === 'findAll') {
//         // const limit = queryOptions[0].limit ?? 10;
//         // const result = [];
//         // for (let x = 0; x < limit; x++)
//         //     result.push(ClienteMock.build({ id: x, nome: 'cliente ' + x, idade: x, uf: 'RS' }));
//         return [];
//     }

//     if (query === 'findOne') {
//         return null;
//     }
// })


module.exports = {
    sequelize: {
        models: {
            Profile: ProfileMock,
            Contract: ContractMock,
            Job: JobMock
        }
    },
    Profile: ProfileMock,
    Contract: ContractMock,
    Job: JobMock
};