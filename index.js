const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const config = require("./config.json");
const input = require("input");

const receivedMessageIds = new Set();
let stringSession = "";

const extractAndFormatMessage = async (message) => {
  //
  const pairMatch = message.match(/#(\w+)\/(\w+)/);
  const positionLeverageMatch = message.match(/\((Long|Short), x(\d+)\)/);
  const entryMatch = message.match(/Entry - ([\d.]+)/);
  const takeProfitMatches = message.match(
    /Take-Profit:\s*([\d.]+).*\n\s*([\d.]+).*\n\s*([\d.]+).*\n\s*([\d.]+)/
  );

  if (pairMatch && positionLeverageMatch && entryMatch && takeProfitMatches) {
    const pair = `${pairMatch[1]}${pairMatch[2]}`;
    const position = positionLeverageMatch[1].toUpperCase();
    const entry = Number(entryMatch[1]);
    const takeProfits = takeProfitMatches.slice(1).join("\n");

    let stopLoss = null;

    if (position === "LONG") {
      let entryValue = entry + entry * 0.003;
      stopLoss = entryValue - entryValue * 0.05;

      stopLoss = Math.round(stopLoss * 1000) / 1000;
    } else {
      let entryValue = entry - entry * 0.003;
      stopLoss = entryValue + entryValue * 0.05;

      stopLoss = Math.round(stopLoss * 1000) / 1000;
    }

    res_mess = `${pair}\n${position}\n20\nX10\nTP:\n${takeProfits}\nSL:\n${stopLoss}`;
    return res_mess;
  } else {
    console.error("Input format is not recognized.");
  }
};

const runCode = async () => {
  try {
    sessionString = fs.readFileSync("session.txt", "utf8"); // Load from file
    stringSession = new StringSession(sessionString);
  } catch (err) {
    console.log("No session file found, starting fresh.");
    stringSession = new StringSession();
  }

  try {
    const data = fs.readFileSync("received_message_ids.txt", "utf8");
    data.split("\n").forEach((id) => {
      if (id.trim()) receivedMessageIds.add(Number(id.trim()));
    });
  } catch (err) {
    console.log("No received_message_ids file found, starting fresh.");
  }

  const client = new TelegramClient(
    stringSession,
    config.apiId,
    config.apiHash,
    {
      connectionRetries: 5,
    }
  );

  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("You should now be connected.");
  fs.writeFileSync("session.txt", client.session.save()); // Save to a file
  console.log("Session saved to session.txt"); // Save this string to avoid logging in again

  const channelBot = await client.getEntity(config.chatIdBot); // get client for sending message for room chat

  client.addEventHandler(async (event) => {
    const message = event.message;

    if (message.message.includes("Entry")) {
      let exec_mess = await extractAndFormatMessage(message.message);

      await client.sendMessage(channelBot, { message: exec_mess });
    }
  }, new NewMessage({ chats: [config.chatId] }));
};

runCode();
