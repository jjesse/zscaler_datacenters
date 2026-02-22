# Overview

One of the problems I have with Zscaler is understanding what Zscaler Datacenter I'm connected to. I see an IP Address that I'm connected to but I don't know what location that is. Zscaler publishes all the Cloud Enforcement Node Ranges at: https://config.zscaler.com/zscalerthree.net/cenr. This data is listed per Cloud (zscaler.net, zscalerone.net, zscalertwo.net, zscalerthree.net, zscloud.net, zscalerbeta.net, zscalergov.net, and zscalerten.net). This data is available via JSON, for example https://config.zscaler.com/api/zscalerthree.net/future/json.

What I'm looking for is a web app that will run in a docker container within my home lab.

Here are the things that I need:
- A good looking User Interface
- Select the Zscaler Cloud that I am connected to
- Input an IP Address
- Return what Zscaler Cloud that I'm talking to
- README.md that covers what we built and how to setup
- TODO.md that covers what we will be building

For example I input: 165.225.28.XX as the connected Zscaler IP Address, then it will respond Amsterdam II.

This should get us started with things

