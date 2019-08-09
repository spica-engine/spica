# Passport

## Table of contents

## Statements
The smallest rule setting in the passport module is the statement. Each statement is responsible for one functionality. As an example; allowing read functionality in bucket system is a statement. Also, you can define specific resources to limit account abilities. Statements settings listed below;
Effect: statements have two effect options. These are “Allow” and “Deny”
Service: to apply statement, you will need to define which service statement will work. You can select service from the select box.
Action: Each service has own actions. For example bucket service has 4 options which are “index”,”show”,”delete”,”update”
Resource: This is the only optional setting for statements. For some of services, you can define specific resources. So the statement will be applied for that particular resource.

## Policies

Policies are a multi-purpose designed rule management structure. To create a rule in the passport module, you can create a policy and assign it to identities. Also to have role-based account management system, you can use policies. A policy can include multiple statements. 

> NOTE: To create role-based account management, you should assign multiple statements to policies. For example; “Content Editor” policy should have all bucket statements and storage statements.


## Identities
An identity means an account in the Spica domain. Each identity has own policies and meta data. You can attach a policy to identity and detach it any time. You can see all attachable policies under identity policies tab.


## Strategies
Our passport module supports SSO strategies as well. You will find SSO settings screen in “Strategies” page. Once you setup your SSO strategy, login button will be visible in login page. You can use both normal login and SSO login at the same time.


## Additional Settings
You can define your identities data model fully flexible. Spice requires email, first name and last name. Also in “Settings” tab, you add new fields and customize your identity data models.
