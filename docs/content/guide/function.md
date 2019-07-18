# Function

## Table of contents

## Overview

### What are functions?

Functions is a event-driven execution context for your spica. Simply, you can attach an event to your function from other modules and services. Your function will be triggered _when the event occurs_.

Within a function you can do nearly everything that you do everyday in node runtime.

### Events and triggers

Events are things that happens in your spica. These might be things like changes to data in a database, files added to a storage system or a http request being received.

### Use cases

The fine-grained, on-demand nature of functions also makes it a perfect candidate for lightweight APIs and webhooks. In addition, the automatic provisioning of HTTP endpoints when you assign a http trigger to function means there is no complicated configuration required as there is with some other services. See the following table for additional common `functions` use cases:

| Use case        | Description                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data processing | Listen and respond to storage events such as when a file is created, changed, or removed. Process images, perform video transcoding, validate and transform data, and invoke any service on the internet from your functions. |
| Webhooks        | Via a simple HTTP trigger, respond to events originating from 3rd party systems like GitHub, Slack, Stripe, or from anywhere that can send HTTP requests.                                                                     |
| APIs            | Compose applications from lightweight, loosely coupled bits of logic that are quick to build and that scale instantly. Your functions can be event-driven or invoked directly over HTTP/S.                                    |
