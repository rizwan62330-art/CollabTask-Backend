require("dotenv").config();
const createApp = require("./app");

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`CollabTask API listening on http://localhost:${PORT}`);
  console.log(`Interactive docs:        http://localhost:${PORT}/api/docs`);
  console.log(`Health check:            http://localhost:${PORT}/api/v1/health`);
});
