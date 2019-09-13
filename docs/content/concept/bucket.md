# Bucket

## Table of Contents

We always think developers should be free and do what they want. This is why we created a fully flexible data modeling system. One of the major features in Spica is the Bucket module. You can create your data models using Bucket module. Each step for creating a bucket has been given below;

- Go to **Developer Area** (on navigator) and open bucket list;
- You will see all the buckets in your project.
- You can create a new bucket here
- Follow bucket creation steps and finalize

Once you create your bucket, Spica will generate Rest API endpoints automatically. So you can send HTTP request to get/update/insert a bucket data.

## Bucket Creation Steps

To create a bucket you need to define bucket name, description, fields and make some customization. Once you finish creating a new bucket, you will see it on navigator. Bucket ID will be assigned automatically so you can access your data via API. For more details visit API Reference.

> NOTE: Until you finalize bucket creation steps, everything will be in memory. So if you change page, your settings will be lost.

Properties

All properties you can use in bucket module have been listed below. For more details please visit API reference.

### Some Examples

Agency name: `string`

Age: `number`

Project release date: `date` with predefined values.

Company address: `richtext` (if you want to enable HTML codes) or `textarea`.

Thumbnail image: `storage`

Phone: `string`

Product name: `string`

## Auto-Publish

For scheduled publish, there is an auto-publish feature in the bucket module. So you can set a date for a specific entry and the system will make that particular entry available in that time. You can see all scheduled entries and published entries in different tabs. To get more details about accessing to scheduled entry, please see API reference.

## History / Revisions

To have a full control in your database, we integrated history system in bucket module. Last x amount of revisions will be stored in database.

NOTE: To make history feature works, you need to have a MongoDB with 3 replica sets.
You can see each revisions by clicking history on right side of screen.

## Real-time

This feature helps you to connect bucket collections and listen to the bucket data and their changes in real-time to handle constantly changing workloads. Unlike API calls, retrieved data will always be actual. You can skip some data row or limit the amount of data you'll get. Sorting and filtering are also supported. Real-time bucket system is mostly useful for chat applications, reservation systems and accounting.
