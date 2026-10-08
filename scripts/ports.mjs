// Demo helper: makes the one dev server answer on two more ports, so the phone versions each have their own address.
//   3210  recruiter (desktop layout on a wide window)
//   3211  recruiter, phone version
//   3212  student, phone version
// The app reads the port from the Host header and picks the matching layout. Run next to `npm run dev -- -p 3210`.
import net from "node:net";

const target = Number(process.env.TIQ_PORT ?? 3210);
const extra = [Number(process.env.TIQ_PORT_RECRUITER_PHONE ?? 3211), Number(process.env.TIQ_PORT_STUDENT ?? 3212)];
for (const port of extra) {
  net.createServer((client) => {
    const upstream = net.connect(target, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    const close = () => { client.destroy(); upstream.destroy(); };
    client.on("error", close); upstream.on("error", close);
  }).listen(port, () => console.log(`http://localhost:${port} -> ${target}`));
}
