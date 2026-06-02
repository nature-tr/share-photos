export default {
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DB_PATH ?? '../data/app.db',
    },
    verbose: true,
    strict: true,
};
