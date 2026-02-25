const axios = require('axios');
async function test() {
try {
  const result = await axios.post("https://api.mypurecloud.com/api/v2/conversations/messages", 
    { useExistingConversation: true },
    { headers: { "Authorization": "Bearer badToken" } }
  );
  console.log(result.data);
} catch (e) {
  console.log(e.response.data);
}
}
test();
