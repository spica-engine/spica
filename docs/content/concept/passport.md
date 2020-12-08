# Passport

Spica supports built-in authentication and authorization on Spica Client and API called as `Passport Module`. Out of the box, Spica supports two different authentication strategies. This document will explain the fundemantals of those stretegies.

## Table of contents

## Statements
The smallest rule setting in the passport module is the statement. Each statement is responsible for one functionality. As an example; allowing read functionality in bucket system is a statement. Also, you can define specific resources to limit account abilities. Statements settings listed below;

`Effect`: statements have two effect options. These are “Allow” and “Deny”

`Service`: to apply statement, you will need to define which service statement will work. You can select service from the select box.

`Action`: Each service has own actions. For example bucket service has 4 options which are “index”,”show”,”delete”,”update”

`Resource`: This is the only optional setting for statements. For some of services, you can define specific resources. So the statement will be applied for that particular resource.

## Policies

Policies are a multi-purpose designed rule management structure. To create a rule in the passport module, you can create a policy and assign it to identities. Also to have role-based account management system, you can use policies. A policy can include multiple statements. 

> NOTE: To create role-based account management, you should assign multiple statements to policies. For example; “Content Editor” policy should have all bucket statements and storage statements.


## Identities
An identity means an account in the Spica domain. Each identity has own policies and meta data. It contains **identifier** and **password** informations for authorization. You can attach a policy to identity and detach it any time. You can see all attachable policies under identity policies tab. 

> Right after the installation, Spica creates a default identitiy to get you started. We suggest you to change at least its password before going live.

To create an Identitiy, navigate to **System** -> **Identities** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **Identifier** and **Password** field.
- Press **Save**

### Adding Additional Properties

If you want to store additional information on **Identities**, you can create custom fields. To create a custom field on Identities, navigate to **System** -> **Settings** in the left-hand menu.

## API Key

Instead of Identity, the API key allows the machine to machine communication. The token, it provides doesn't have an expiration date so it can be used as long as it is not intentionally deleted from Spica.

To create an API Key, navigate to **System** -> **API Keys** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **name** and **description** field.
- Press **Save**

Once the saving completed, you can use the **API Key** value on your API calls on header section.

> For more informations about how to use API Key, please refer the API Documentations.

## Strategies
Our passport module supports SSO strategies as well. You will find SSO settings screen in “Strategies” page. Once you setup your SSO strategy, login button will be visible in login page. You can use both normal login and SSO login at the same time.

[TODO] = how to create SSO

## Additional Settings
You can define your identities data model fully flexible. Spice requires email, first name and last name. Also in “Settings” tab, you add new fields and customize your identity data models.

## Policies

Policies are basically a set of rules which can be attached to your **Identities** and **API Keys** to encapsulate and control their capabilities.

### Using the Policies

Spica cames with various different built-in Policies to meet your needs on encapsulation, so you don't have to create each of them individually.

To attach Policies, enter either **Identity Edit Page** or **API Key Edit Page**. At the bottom, you will see `Owned Policies` section.

To attach the policy, click the `link` buttom. To detach click on `unlink` button.

![Example Policies](assets/images/docs/passport/policies.png)

### Creating a Custom Policy

It is possible to create your own Custom Policy by clicking on the `+` button on Policies page to create from scratch or clone a Policy and start to work where it left off by clicking the `copy` button on Policies page next to each policy.

Here you can enter your Policy's `Name` and `Description`.

Click on `Add Statement` button to add new statement. You'll see a new statement added to list in that page. You'll see a new form to fill. Let's dig in.

`Effect`: If you want to restrict a certain sets of rules, set the Effect as `Deny`, otherwise select `Allow`.

`Service`: Select the scope of the Statement.

`Actions`: After selecting the scope, this input will show up. You'll see a list of actions on the selected scope. Select one or more actions to add them to your Statement.

`Add Resource`: Optional. If you want to allow/deny actions on resource based, add resource and enter the \_id of the resource. You can add infinite number of resources to a Statement.

![Example Custom Policy](assets/images/docs/passport/custom_policies.png)
