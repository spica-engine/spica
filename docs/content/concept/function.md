# Function

## Table of contents

## Concept
You can use functions to apply custom logic in your projects. You can find the function area in **Developer Area**. Once you create your function, the system will assign ID automatically. To create a function you need to define a name and description first. This data will be displayed in the function list. After you define metadata, you will see the code editor which you can write your own codes. 

## Triggers
The system will run this code whenever something triggers to function. There are different types of triggers.

### Database
When something has been changed in a specific resource such as bucket or policies, it triggers to function.
> NOTE: You can toggle on “Full Document” setting if you want to get all entry. If you toggle off this setting, you will get changes only.

### HTTP
HTTP request will trigger the function.

### Schedule
You can run functions in time intervals. To set interval, you can use CRON base rules. As an example: if you set time interval "`* * * * *`", function will be executed in every minute.

### Firehose

Firehose is a low latency, event based and realtime trigger. It communicates through an open socket connection which makes low latency communication possible. You can communicate with Firehose on bidirectional I/O events.

An event can contain two parameters; Event Name and Event Data

Event Name: `string`
Event Data: `any`

## Dependencies
If your function needs another 3rd party package, you can include 3rd party package as a dependency. Each dependency will be imported before the system runs the function.

## Environment Variables
Also, you can set environment variables and these variables will be passed to function as a global parameter. To get more detail please visit API reference.
