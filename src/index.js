// Local / traditional-host entry point (not used by Vercel — see api/index.js).
const app = require("./app");

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Flow Tracker backend listening on port ${port}`));
