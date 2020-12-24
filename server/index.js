// WARNING ONLY RUN THIS LOCALLY

const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/save-images', bodyParser.json({ limit: '500mb' }), (req, res) => {
  const { options, framesData } = req.body;

  const directory = `data/${options.directory}`;
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }

  for (const [frameName, frameData] of Object.entries(framesData)) {
    const base64Data = frameData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(`${directory}/${frameName}.png`, base64Data, 'base64');
  }

  console.log(
    `Saved ${Object.keys(framesData).length} files to ${
      options.directory
    } directory`
  );

  res.send('okay :)');
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
