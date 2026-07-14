// Local / traditional-host entry point (not used by Vercel — see api/index.js).
const app = require("./app");

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Design Status backend listening on port ${port}`));
