import DHT from 'hyperdht'
import b4a from 'b4a'
import Protomux from 'protomux'
import Channel from 'jsonrpc-mux'
const key = '5487d14f0e47ae9cea53fe611e3b8e08d8e0792a5e3b76da1405dad2f726d3a1'
const publicKey = b4a.from(key, 'hex')

const dht = new DHT()
const conn = dht.connect(publicKey)
const framed = new Channel(new Protomux(conn))

conn.once('open', async () => {
  const api = await framed.request('_swag', {})
  console.log(api)
  const el = document.getElementById('editor_holder')
  const schema = api.routes[0]
  schema.title = schema.name
  const editor = new JSONEditor(el, { compact: true, schema }) 

  document.getElementById('submit').addEventListener('click',function() {
    console.log(editor.getValue());
  });

  // const schema = await client._swag()
  console.log(schema)

})



