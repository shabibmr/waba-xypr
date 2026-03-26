const amqp = require('amqplib');
const payload = {
  "tenantId": "t_4abc26fe71393c4f",
  "wamid": "wamid.HBgMOTE5ODQ3MTA2MTc2FQIAEhggQUMzODM1OUFDNUJDQjcwMEVGQTZFQTZERUE0MjVGOEMA",
  "wa_id": "919847106176",
  "contact_name": "Shabb",
  "timestamp": "1773542393",
  "message_text": "Yes",
  "media_url": null,
  "media_mime_type": null,
  "media_filename": null,
  "message_type": "text",
  "message_metadata": null,
  "phone_number_id": "882555404932892",
  "display_phone_number": "971566681782"
};

async function run() {
  // Using credentials from .env: RABBITMQ_PASSWORD=your_rabbitmq_password
  const conn = await amqp.connect('amqp://user:your_rabbitmq_password@localhost');
  const ch = await conn.createChannel();
  ch.sendToQueue('inbound.whatsapp.msg', Buffer.from(JSON.stringify(payload)));
  console.log("Message sent directly via node amqplib");
  await ch.close();
  await conn.close();
}
run().catch(console.error);
