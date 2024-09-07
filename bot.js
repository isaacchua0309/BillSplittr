// Import necessary libraries
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Your bot token from BotFather
const token = '7241847931:AAHcQjH2zgTeuP0MOiMoYzlk1Z9kpEUSa2Q'; // Replace this with your bot token
const bot = new TelegramBot(token, { polling: true });

let contacts = [];

// Function to save contacts to a JSON file
function saveData() {
  fs.writeFileSync('contacts.json', JSON.stringify(contacts, null, 2));
  console.log('Data saved successfully!');
}

// Function to load contacts from a JSON file
function loadData() {
  if (fs.existsSync('contacts.json')) {
    const data = fs.readFileSync('contacts.json');
    contacts = JSON.parse(data);
    console.log('Data loaded successfully!');
  } else {
    console.log('No data found, starting fresh.');
  }
}

// Load data when the bot starts
loadData();

// Function to add a new contact
function addContact(username) {
  contacts.push({ username, amountOwed: 0 });
  saveData(); // Save after adding a new contact
}

// Function to update the amount owed by a user
function updateAmountOwed(username, amount) {
  let user = contacts.find(contact => contact.username === username);

  if (user) {
    user.amountOwed += amount;
  } else {
    addContact(username);
    user = contacts.find(contact => contact.username === username);
    user.amountOwed += amount;
  }

  saveData(); // Save after updating or adding the contact
  console.log(`Updated ${username} owes $${amount}.`);
}

// Function to delete a contact by username
function deleteContact(username) {
  const index = contacts.findIndex(contact => contact.username === username);

  if (index !== -1) {
    contacts.splice(index, 1); // Remove the contact
    saveData(); // Save the updated array to the JSON file
    return true; // Contact deleted successfully
  } else {
    return false; // Contact not found
  }
}

// Example /balance command to check current balances
bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;

  let balanceMessage = 'Current balances:\n';
  contacts.forEach(contact => {
    balanceMessage += `${contact.username} owes $${contact.amountOwed}\n`;
  });

  bot.sendMessage(chatId, balanceMessage);
});

// Step 1: Start the /addbill process, ask for the receipt picture
bot.onText(/\/addbill/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Please upload a picture of the receipt.");

  // Listen for the photo message from the user
  bot.on('photo', async (msg) => {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const filePath = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Now you have the receipt image URL, proceed with the next step
    analyzeReceipt(filePath, chatId);
  });
});

// Step 2: Analyze the receipt using OCR or another external API
async function analyzeReceipt(imageUrl, chatId) {
  try {
    // Example: Using an external OCR API to extract data
    const response = await axios.post('YOUR_OCR_API_ENDPOINT', {
      image_url: imageUrl,
    });

    // Sample extracted data from OCR API (You should adapt this to your API's response)
    const items = [
      { name: 'Pizza', price: 12 },
      { name: 'Pasta', price: 10 },
      { name: 'Soda', price: 3 }
    ];

    // Send the list of items to the user and ask for the participants
    bot.sendMessage(chatId, `Receipt analysis complete! Here are the items:\n${items.map(item => `${item.name} - $${item.price}`).join('\n')}`);
    askForParticipants(chatId, items);
  } catch (error) {
    bot.sendMessage(chatId, "There was an error processing the receipt. Please try again.");
    console.error(error);
  }
}

// Step 3: Ask for the participants of the meal
function askForParticipants(chatId, items) {
  bot.sendMessage(chatId, 'Which contacts participated in the meal? Please type their usernames separated by commas.');

  bot.once('text', (msg) => {
    const participants = msg.text.split(',').map(participant => participant.trim());

    // Proceed to assign items to participants
    assignItemsToParticipants(chatId, participants, items);
  });
}

// Step 4: Assign items to participants with checkboxes
function assignItemsToParticipants(chatId, participants, items) {
  items.forEach((item, index) => {
    const options = {
      reply_markup: {
        inline_keyboard: participants.map(participant => [
          {
            text: participant,
            callback_data: JSON.stringify({ itemIndex: index, participant })
          }
        ])
      }
    };

    bot.sendMessage(chatId, `Who had the ${item.name} ($${item.price})?`, options);
  });

  // Listen for responses and assign items to participants
  bot.on('callback_query', (callbackQuery) => {
    const data = JSON.parse(callbackQuery.data);
    const { itemIndex, participant } = data;

    // Assign the item to the participant
    const selectedItem = items[itemIndex];
    updateAmountOwed(participant, selectedItem.price);

    // Acknowledge the response
    bot.answerCallbackQuery(callbackQuery.id, { text: `${participant} selected for ${selectedItem.name}.` });
  });
}
