import DHT from 'hyperdht'
import b4a from 'b4a'
import Protomux from 'protomux'
import Channel from 'jsonrpc-mux'
const dht = new DHT()

document.getElementById('connect').addEventListener('click', () => {
  const peerKey = document.getElementById('peerKey').value
  destroy()
  connect(peerKey)
})

function destroy () {
    document.getElementById('api').style.display = 'none'
    document.getElementById('role').innerHTML = ''
    document.getElementById('version').innerHTML = ''
    document.getElementById('description').innerHTML = ''
}

function connect (peerKey) {
  const publicKey = b4a.from(peerKey, 'hex')
  const conn = dht.connect(publicKey)
  const framed = new Channel(new Protomux(conn))
  conn.once('open', async () => {
    const api = await framed.request('_swag', {})

    console.log(api)

    document.getElementById('api').style.display = 'block'
    document.getElementById('role').innerHTML = api.role
    document.getElementById('version').innerHTML = api.version
    document.getElementById('description').innerHTML = api.description

    const routesHolder = document.getElementById('routes')
    api.routes.forEach(route => {
      console.log(route)
      const routeDiv = document.createElement('div')



      routesHolder.appendChild(routeDiv)
      const editor = new JSONEditor(routeDiv, { compact: true, schema: route.paramSchema }) 
    })

    // const el = document.getElementById('editor_holder')
    // const schema = api.routes[0]
    // schema.title = schema.name
    // const editor = new JSONEditor(el, { compact: true, schema }) 

    // document.getElementById('submit').addEventListener('click',function() {
    //   console.log(editor.getValue());
    // });

    // const schema = await client._swag()
    // console.log(schema)
  })
}




