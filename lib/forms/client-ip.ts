// Extrae la IP del visitante de la cadena `X-Forwarded-For`.
//
// La primera versión de esto tomaba la IP de MÁS A LA IZQUIERDA, que es el
// enfoque intuitivo y está mal: esa es la que el visitante puede escribir.
// Alcanza con mandar `X-Forwarded-For: 1.2.3.4` a mano para que el proxy
// agregue la IP real DESPUÉS, y la de la izquierda quede siendo la inventada.
// Como el front reenvía esa IP a la API y la API confía en el front, el
// resultado era que cualquiera podía saltearse el rate limit del formulario
// cambiando un header.
//
// Lo correcto es contar desde la DERECHA: cada proxy agrega al final lo que
// vio, así que las últimas entradas son las únicas que el visitante no pudo
// falsificar. Con un proxy adelante (el caso de Dokploy), la última entrada es
// la IP real del visitante.
//
//   El visitante manda:   X-Forwarded-For: 1.2.3.4            (inventada)
//   El proxy agrega:      X-Forwarded-For: 1.2.3.4, 200.5.6.7 (la real)
//                                          ↑ falsa    ↑ confiable
//
// Si algún día se agrega otro proxy en el camino, hay que subir
// TRUSTED_PROXY_HOPS: si no, se toma la IP del proxy intermedio en vez de la
// del visitante. Eso no abre un agujero —no es falsificable— pero haría que
// todos los visitantes compartan un cupo.

export function ipDesdeForwardedFor(
  forwardedFor: string | null,
  proxiesConfiables: number,
): string | null {
  if (forwardedFor === null) return null;

  const cadena = forwardedFor
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip !== "");

  if (cadena.length === 0) return null;

  const hops = Math.max(Math.trunc(proxiesConfiables) || 1, 1);
  const indice = cadena.length - hops;

  // La cadena puede ser más corta que los hops esperados: pasa en local, sin
  // proxy. Se usa la primera, que en ese caso es la única.
  return cadena[Math.max(indice, 0)] ?? null;
}

// Límite inherente: si este server quedara expuesto SIN un proxy adelante, la
// cadena entera la escribe el visitante y no hay nada confiable que tomar. Por
// eso la otra mitad de la defensa está en la API, que solo acepta el header
// reenviado si la conexión viene de una IP declarada como proxy confiable. Si
// el front no está en esa lista, el header se ignora y el límite vuelve a ser
// compartido: degrada, no se abre.
//
// `x-real-ip` NO se usa a propósito. Solo es confiable si el proxy la
// sobrescribe; si no lo hace, la escribe el visitante y volvemos al mismo
// agujero. Sin ella, cuando no hay forma confiable de saber la IP no se manda
// el header y la API cae a su comportamiento anterior: un cupo compartido.
// Es peor para el visitante legítimo y seguro contra el que no lo es.
