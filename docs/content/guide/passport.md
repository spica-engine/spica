## Passport

Fundamentally, this module is used for authentication and authorization on Spica Client and API.

### Authentication

Out of the box, Spica supports two different authentication stretagies. This document will explain the fundemantals of those stretegies.

#### Identity

Fundemantally, Identities are the users of a Spica instance. It contains **identified** and **password** informations for login.

> Right after the installation, Spica creates a default identitiy to get you started. We suggest you to change at least its password before going live.

To create an Identitiy, navigate to **System** -> **Identities** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **Identifier** and **Password** field.
- Press **Save**

##### Adding Additional Properties

If you want to store additional informations on **Identities**, you can create custom fields. To create a custom field on Identities, navigate to **System** -> **Settings** in the left-hand menu.

#### API Key

Instead of Identity, API key is allows the machine to machine communication. The token, it provides doesn't have an expiration date so it can be used as long as it's intentionally deleted from Spica.

To create an API Key, navigate to **System** -> **API Keys** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **name** and **description** field.
- Press **Save**

Once the saving completed, you can use the **API Key** value on your API calls on header section.

> For more informations about how to use API Key, please refer the API Documentations.

<!-- #### SSO Integration -->

### Policies

Policies are basically a set of rules which can be attached to your **Identities** and **API Keys** to encapsulate their behavior.

#### Using the Policies

Spica cames with various different built-in Policies to meet your needs on encapsulation, so you don't have to create each of them individually.

To attach Policies, enter either **Identity Edit Page** or **API Key Edit Page**. At the bottom, you will see `Owned Policies` section.

To attach the policy, click the `link` buttom. To detach click on `unlink` button.

#### Creating a Custom Policy

It is possible to create your own Custom Policy by clicking on the `+` button on Policies page to create from scratch or clone a Policy and start to work where it left off by clicking the `copy` button on Policies page next to each policy.

Here you can enter your Policy's `Name` and `Description`.

Click on `Add Statement` button to add new statement. You'll see a new statement added to list in that page. You'll see a new form to fill. Let's dig in.

`Effect`: If you want to restrict a certain sets of rules, set the Effect as `Deny`, otherwise select `Allow`.

`Service`: Select the scope of the Statement.

`Actions`: After selecting the scope, this input will show up. You'll see a list of actions on the selected scope. Select one or more actions to add them to your Statement.

`Add Resource`: Optional. If you want to allow/deny actions on resource based, add resource and enter the \_id of the resource. You can add infinite number of resources to a Statement.
