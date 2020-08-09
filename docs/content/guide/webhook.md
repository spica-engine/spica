# Webhook

Webhook module is designed for the automation of flow. It listens to the events in the Spica environment and sends an HTTP/POST call when a specific event occurs. You can set a post-action trigger which will be one of the following collection triggers; `INSERT`, `UPDATE`, `DELETE`, `REPLACE`

As an example, to automate your marketing campaign you can use 3rd party email services with using webhook module. Once you attach an `INSERT` hook to registration bucket, the system will send a webhook call whenever you insert a data to your registration bucket via API or control panel.

To set up a webhook, you have to define a name, body and a trigger.

- Webhook name can be any string value
- Webhook body should be in JSON format. To take a value from your bucket, you can use three curly braces. So as an example you can set your webhook body like `{“text”: “{{{document.title}}}“}`
- Webhook trigger can be any of `INSERT`, `UPDATE`, `DELETE`, `REPLACE` values.

> IMPORTANT: Each webhook trigger works after the action happens. So, if you use `DELETE` trigger for a webhook, you can not reach `document` fields because `document` will be already removed when the Spica sends the webhook call.

Example webhook body:

```
{
  "title": “{{{document.title}}}“,
  "description": “Lorem ipsum“,
  "avatar": “{{{document.thumbnail}}}“
}
```

### Webhook Logs

You can see all webhook acitivites in `Webhook Logs` section. You can filter the logs by webhook ID, date or result (success/fail). In a standart build of Spica, there is no time limitation on webhook logs. So you can store all webhook logs forever.

> IMPORTANT: Because of no time limit on webhook logs, we suggest you to clear webhook logs in a time interval. Otherwise you should consider your server hardwares to use Spica instance with hight performance.
