const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const config = require("./config.json");
const input = require("input");

const receivedMessageIds = new Set();
let stringSession = "";

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

  const channel = await client.getEntity(config.chatId);
  const channelBot = await client.getEntity(config.chatIdBot);

  const fetchNewMessages = async () => {
    let messages = await client.getMessages(channel, {
      limit: 100, // Set the limit as needed, you can paginate if necessary
    });
    messages = messages.filter((x) => !x.replyTo);

    let newMessages = messages.filter(
      (message) =>
        !receivedMessageIds.has(message.id) &&
        message?.message?.includes("Entry")
    );

    newMessages = newMessages.sort((a, b) => a.id - b.id);

    newMessages.forEach((message, index) => {
      setTimeout(async () => {
        let stopLoss;
        let newMessage = message.message.split("\n");
        let entryValue = "";
        newMessage = newMessage.filter((x) => {
          if (x.startsWith("Entry")) {
            entryValue = x.split("-")[1].trim();
          }
          return !x.includes("ADMIN : @zhaozhao68") && x.length > 0;
        });

        entryValue = Number(entryValue);

        newMessage = newMessage.map((x) => {
          if (x.includes("Short")) {
            stopLoss = entryValue + entryValue * 0.05;

            stopLoss = Math.round(stopLoss * 1000) / 1000;

            return x.replace("(Short, x20)", "\nSHORT");
          }
          if (x.includes("Long")) {
            stopLoss = entryValue - entryValue * 0.05;

            stopLoss = Math.round(stopLoss * 1000) / 1000;

            return x.replace("(Long, x20)", "\nLONG");
          }
          return x.trim();
        });

        newMessage = newMessage.map((x) => {
          const index = x?.indexOf("(");
          return index !== -1 ? x.slice(0, index).trim() : x.trim();
        });

        newMessage.push(`Stop Loss : ${stopLoss}`);
        newMessage = newMessage.join("\n");
        console.log(`Message ID: ${message.id}`);
        console.log(newMessage);

        // await client.sendMessage(channelBot, { message: newMessage });

        receivedMessageIds.add(message.id);
      }, 2000 * index);
    });

    fs.writeFileSync(
      "received_message_ids.txt",
      Array.from(receivedMessageIds).join("\n")
    );
  };

  fetchNewMessages();
  setInterval(fetchNewMessages, 60000);
};

runCode();
