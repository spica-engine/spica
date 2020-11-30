# Storage

This module is essentially a file manager on your Spica instance. You can store, list and delete your files via this module.

### Online Image Editor

To edit image typed storage item, click the `three dots` next to the item to open the context menu. Clicking the `edit` button will takes you to the Image Editing page.

On that page you crop the image, scale by percentage and rotate the image as you wish. Click on the `tick` icon to save the image after editing.

### Google Cloud Storage Integration

Spica supports Google Cloud Storage out-of-the-box.

First you have to download your service account. To download follow these steps:

- In the Cloud Console, go to the Service Accounts page.
- Click Select a project, choose a project, and click Open.
- Find the row of the service account that you want to create a key for. In that row, click to the More button, and then click to the Create key button.
- Select the Key type as JSON and click Create.

Clicking to the Create button, downloads a service account key file. Make sure that you store this file securely because it can be used to authenticate as your service account.

To integrate your Cloud Storage account, you have to either restart or create a new instance with the following parameters:

```shell
  $ spica serve <docker machine name> -- --storage-strategy="gcloud" --gcloud-service-account-path=<where you download the service account file> --gcloud-bucket-name=<GCloud bucket name>
```

> IMPORTANT: GCloud bucket should be configured for public access.
