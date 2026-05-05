---
title: A tunnel module for nginx
date: 2026-05-05
image: /assets/2026-05-05-resources/illustration.png
categories:
  - Tech
authors:
  - Zihao Fu
draft: true
---

As shown above, nginx is massively used as a reverse proxy and load balancer, which is the 'universal' proxy for the server,
however the support for 'proxy for the client' is still immature.

<a href="https://github.com/ZihaoFU245/ngx_http_tunnel_module" target="_blank" rel="noopener">
  <img
    src="https://opengraph.githubassets.com/1/ZihaoFU245/ngx_http_tunnel_module"
    alt="ZihaoFU245/ngx_http_tunnel_module GitHub repository"
    style="max-width: 50%; border-radius: 8px; border: 1px solid #d0d7de;"
  />
</a>

**The source code is licensed under a BSD License.**

---

## Table of contents

## What problem is it solving?

This is basically a forward proxy for nginx, supporting following:

- HTTP/1.1 CONNECT
- HTTP/2 CONNECT
- HTTP/3, CONNECT over QUIC
- CONNECT can co-exist with other HTTP methods
- Probe resistance
- Proxy Authentication
- Map based ACL
- Naive style padding protocol

WIP:

- Extended CONNECT, including connect-udp

### Why it exists? What is vanilla nginx missing?

You can use nginx upstream module to achieve a HTTP forward proxy, but that is limited to HTTP/1.1.
As to vanilla nginx tunnel module, it is simply a wrapper around upstream module, by setting `u->upgrade`
internally. 

An example config to achieve this:

```nginx
server {
  listen ...;
  resolver ...;
  # Some SSL settings

  location / {
    proxy_pass http://$http_host$uri;
    proxy_http_version 1.1;     # Since Nginx 1.29.7, this is default
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $http_host;
  }
}
```

This is commonly used for Websocket proxying, here are the 3 phases:

- Phase 1: Client send, for example, a GET request. Nginx received, set upgrade header,
and proxy pass it to upstream.

- Phase 2: Upstream server send 101, connection upgrades. Nginx stops parsing HTTP requests.

- Phase 3: At this point, Nginx is simply doing TCP bidirectional byte relay.

**Comparing to CONNECT**

For HTTP/1.1 CONNECT, client sends:

```http
CONNECT example.com:443 HTTP/1.1
Host: example.com:443
```

Vanilla Nginx tunnel module parse it, then set up upstream, set `ignore_input` and `u->upgrade` to 1.
The official module can open a TCP byte relay for client but it lacks support over H2 and QUIC. This is
where my module do, it add supports for CONNECT over h2 and h3. CONNECT over h2/h3 is a huge benefit, it
can use multiplexing, only use 1 TCP/QUIC connection for multiple connect requests, binary framing makes parsing
faster, and 0-RTT for h3.

> [!NOTE]
> 0-RTT, TCP fast open can't be done if padding is used, defined by naiveproxy.

### Why `proxy_pass` is not enough?

`proxy_pass` uses nginx http upstream module, it is mainly used for HTTP reverse proxying,
connect is different, it requires a raw byte tunnel, which is some features in nginx stream
upstream module. That means the tunnel module can not be simply done by reusing http upstream
module, either handles the byte relay manually or do surgical changes to http upstream module.
In my implementation, I only used http upstream module to open a connection to upstream, then
handles byte relay myself, similar to stream upstream module did internally. This makes minimal
changes to nginx core.

## Why it is called a tunnel? (Background knowledge)

Tunnel by definition in this context is establish a secure, private communication path
between 2 points over a public network. This modules goal is to establish a byte relay
connection between client and nginx server. Though the security is guarded by users nginx
configuration, ie. SSL support.


### What is HTTP CONNECT?

**HTTP CONNECT** is a technique used to establish a secure, direct TCP tunnel through
an HTTP proxy server, it is often used to tunnel other protocols, like https tunneling,
TCP/UDP tunneling.

Method CONNECT differs in HTTP/1.1 and H2/H3

In HTTP/1.1, CONNECT is commonly sent as:

```http
CONNECT example.com:443 HTTP/1.1
Host: example.com:443
```

In h2/h3 it looks like this:

```http
:method: CONNECT
:authority: example.com:443
```

There is an extended connect request, `connect-udp`, looks like this:

```http
:method: CONNECT
:protocol: connect-udp
:scheme: https
:authority: proxy.example.com
:path: /.well-known/masque/udp/{target_host}/{target_port}/
capsule-protocol: ?1
```

Defined by RFC 9298 and RFC 9297 for capsule protocol

### Difference between reverse proxy, forward proxy

Differences between reverse proxy and forward proxy is who the server
is proxy for? Reverse proxy is for servers, and forward proxy is for
clients.

This tunnel module is a forward proxy, proxy for the clients.

## Differences in implementation

#### [F5 Nginx tunnel module](https://nginx.org/en/docs/http/ngx_http_tunnel_module.html)

This module is included in nginx paid version as an addon. While in nginx-1.31 roadmap,
it will be moved from paid version to nginx OSS.

It is still unclear until, May 5 2026, weather it will add support for connect
over h2 and h3.

The source code of this module can be found on an ongoing PR
in nginx oss repo, [here](https://github.com/nginx/nginx/pull/707). The code
quality without a doubt is high, as it is written by nginx maintainers.

I read this implementation, and adopted the idea that using upstream module
for initializing request to target. This avoids manual hostname resolution
and creating upstream round robin peer. It saved a lot of work for async DNS
resolution and eliminated likelihood of making an error. My modules HTTP/1.1
is aligned with this version.

**Where I still handled myself**

- Proxy Authenticate: Because the need of probe resistance. Probe resistance,
this idea is from caddy's forward proxy.

#### [Proxy connect module from Alibaba](https://github.com/chobits/ngx_http_proxy_connect_module)

This one is a community maintained version of forward proxy, the copyright
showed it is from Alibaba group.

**What is the problem of this module? And why I don't like it.**

1. Consider the 11 phases of nginx[^1], this module is registered at
**NGX_HTTP_POST_READ_PHASE**. It checks weather connect is allowed in before
rewrite phases. However, nginx core internally exposed a flag `allow_connect`
in core parsing. This handler is no longer needed.

2. Bypass Rewrite phase decision. Eg. `location / {return 403;}`, if this is intended
to return 403 for all requests, the post phase handler would bypass it and may return 405.

3. Not actively maintained anymore, it is 2 years since last commit.
May have compatibility issue with mainline nginx.

As a result, I did not take too much inspiration on this module, it only
showed me a way for handling connect, but it definitely is not the optimal.

## How is works internally?

## What is the data flow looks like?

## HTTP/2 and QUIC support?

## Extended CONNECT, including connect-udp?

### What is MASQUE and Capsule protocol?

## Auth and ACL

## Performance characteristics

## Edge cases

## Why not use existing tools?

## Usage example

---

[^1]: HTTP Phases in nginx internal: https://nginx.org/en/docs/dev/development_guide.html#http_phases

---

**Nginx® and the Nginx logo are trademarks of F5, Inc.. All rights reserved. This website is not affiliated with or endorsed by F5 or the Nginx project.**

**The image “illustration.png” was generated using OpenAI Image 2 and is used for illustrative purposes only.**
