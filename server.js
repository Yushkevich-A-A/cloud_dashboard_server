const http = require('http');
const Koa = require('koa');
const { streamEvents } = require('http-event-stream');
const koaBody = require('koa-body');
const app = new Koa();
const Router = require('koa-router');
const json = require('koa-json');
const router = new Router();
const uuid = require('uuid');
const { eventSubscription } = require('./db/db');

const instances = [{
  id: uuid.v4(),
  state: 'stopped',
},
{
  id: uuid.v4(),
  state: 'running',
}
];

app.use( koaBody({
  urlencoded: true,
  multipart: true,
  json: true,
}));

app.use(json());

app.use( async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*' };

  if (ctx.request.method !== 'OPTIONS') {
    console.log('! OPTIONS');
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }
    ctx.response.status = 204;
  }
})

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());

router.get('/sse', async (ctx) => {
  streamEvents(ctx.req, ctx.res, {
    async fetch() {
      return [];
    },
    stream(sse) {
      eventSubscription.listen(( item => {
        sse.sendEvent({
          data: JSON.stringify(item),
        });
      }));
      return () => {};
    }
  });
  ctx.respond = false;
});

router.get('/instances', async (ctx) => {
  ctx.response.body = instances;
})

router.post('/instances', async (ctx) => {
  const id = uuid.v4();
  eventSubscription.translationEvent({
    log: {
      id: id,
      date: Date.now(),
      text: 'Reseived "Create command"',
    },
    data: null,
  })
  setTimeout(() => {
    const newInstance = {
      id: id,
      state: 'stopped',
    }
    instances.push(newInstance)
    eventSubscription.translationEvent({
      log: {
        id: id,
        date: Date.now(),
        text: 'Created',
      },
      data: {
        status: 'created',
        instance: newInstance,
      },
    });
  }, 10000);
  
  ctx.response.body = {
    status:'ok',
  };
})

router.put('/instances/:id/:state', async (ctx) => {
  const id = ctx.params.id;
  const command = (ctx.params.state === 'running') ? 'Start' : 'Stop';
  eventSubscription.translationEvent({
    log: {
      id: ctx.params.id,
      date: Date.now(),
      text: `Reseived "${command} command"`,
    },
    data: null,
  })
  setTimeout(() => {
    const instance = instances.find(item => item.id === id);
    instance.state = ctx.params.state;
    const completeCommand = (ctx.params.state === 'running') ? 'Started' : 'Stopped';

    eventSubscription.translationEvent({
      log: {
        id: id,
        date: Date.now(),
        text: completeCommand,
      },
      data: {
        status: ctx.params.state,
        instanceId: id,
      },
    });

  }, 10000);
  ctx.response.body = {
    status:'ok',
  };
})

router.delete('/instances/:id', async (ctx) => {
  const id = ctx.params.id;
  eventSubscription.translationEvent({
    log: {
      id: ctx.params.id,
      date: Date.now(),
      text: `Reseived "Delete command"`,
    },
    data: null,
  })
  setTimeout(() => {
    const instanceIndex = instances.findIndex(item => item.id === ctx.params.id);
    instances.splice(instanceIndex, 1);
    eventSubscription.translationEvent({
      log: {
        id: id,
        date: Date.now(),
        text: 'Deleted',
      },
      data: {
        status: 'delete',
        instanceId: id,
      },
    });
    
  }, 10000);
  ctx.response.body = {
    status:'ok',
  };
})

app.use(router.routes());
app.use(router.allowedMethods());

server.listen(port);