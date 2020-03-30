# Getting Started
## Introduction
These documents will take you from 0 to hero and helps you to discover advanced features of Spica Development Engine.
### What is Spica?
Spica (a.k.a. Spica Development Engine) is an open-source package that gives virtually everything a backend developer needs. It gives a pre-built administration panel and a fully manageable REST API. It can be used as a backend service, a database layer, or as a headless CMS for managing content. 

You don’t need to know coding to use Spica. 

Spica is built to…. // TODO:
### Differences Between Spica API and Spica Client
Spica Development Engine divided into two parts because of principal differences.

Spica API, is a fully controllable REST API. As Spica has an API-first approach, any features of the engine are controllable via HTTP calls. Also, it’s suitable to integrate with any frontend application to free the product owners from backend development costs.

Spica Client, on the other hand, is a user-friendly admin panel for those who like to manage their development process from a panel with a few clicks. It contains nearly every 
## Installation
### Requirements
### Setup
### Logging In
### Contributing

## Glossary
Explain the common terms of Spica eg. buckets, bucket data, functions, passport, etc.

### Buckets
Buckets are schemas of your data. They keep all the necessary information about your data such as their structure, validations.

### Passport
User management module of Spica. It contains Identities, Policies, and Strategies. (see below for the detailed explanation)

### Functions
 
# Guides
## Buckets as Data Layer
Buckets are the main foundation of Spica Development Engine. While creating a Bucket, the user defines a data schema. 

### Outlining Data Schemas
To create a new Bucket, go to Bucket listing page and find the plus (+) icon. Clicking it will take you to Bucket creation page. Or if you want to edit one of your Buckets, on the listing page find the desired Bucket and click the pen icon next to it.
Bucket Create/Edit form divides into a few sections.

#### Top Bar and Describe
On the top bar, you'll see an icon as default. You can click to change the icon of the Bucket. That icon will be shown on the sidebar next to the Bucket title.

To save the Bucket, you have to enter a Title and a Description to explain the Bucket's purpose. While the Title is limited to 15 characters, Description is limited with 250.

#### Properties
Here, in this section, you will define what kind of data the Bucket will hold. By default, Description and Title properties are created. You can delete those properties by clicking the red trash icon to start with a blank Bucket.

To enter a new property, find the text-box with "Enter a property name" placeholder. Enter a unique, lowercase property name and then click the button next to it to save.

Remember: Spica stores the property names as JSON keys. For this, special characters, spaces and such are forbidden.
You'll see the name of the newly created property is added to the list. Click on it to edit the property and its options.

#### View
You can customize the Bucket Data Create/Edit page from this section. Left, Right and Bottom represent the divisions of the layout on Bucket Data Create/Edit page.

You can drag and drop the Bucket Properties to the desired division.

Remember: You can't save a Bucket if you left one or more Properties on No Position list.

