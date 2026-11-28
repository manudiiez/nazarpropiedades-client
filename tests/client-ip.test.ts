import { describe, expect, it } from "vitest";
import { ipDesdeForwardedFor } from "@/lib/forms/client-ip";

const VISITANTE = "200.5.6.7";
const INVENTADA = "1.2.3.4";

describe("ipDesdeForwardedFor", () => {
  // El bug que esto arregla: tomar la IP de la izquierda es tomar la que el
  // visitante escribió. Mandando un X-Forwarded-For a mano se salteaba el
  // rate limit del formulario, porque el front reenvía esa IP a la API y la
  // API confía en el front.
  it("ignora la IP que el visitante puede falsificar", () => {
    const cadena = `${INVENTADA}, ${VISITANTE}`;
    expect(ipDesdeForwardedFor(cadena, 1)).toBe(VISITANTE);
    expect(ipDesdeForwardedFor(cadena, 1)).not.toBe(INVENTADA);
  });

  it("con varias IPs inventadas sigue tomando la que agregó el proxy", () => {
    expect(ipDesdeForwardedFor(`1.1.1.1, 2.2.2.2, 3.3.3.3, ${VISITANTE}`, 1)).toBe(VISITANTE);
  });

  it("sin proxy, con una sola IP, la usa", () => {
    expect(ipDesdeForwardedFor(VISITANTE, 1)).toBe(VISITANTE);
  });

  it("con dos proxies declarados cuenta dos desde la derecha", () => {
    // [inventada, visitante, proxy1] → el visitante está a dos de la derecha.
    expect(ipDesdeForwardedFor(`${INVENTADA}, ${VISITANTE}, 10.0.0.1`, 2)).toBe(VISITANTE);
  });

  it("tolera espacios y entradas vacías", () => {
    expect(ipDesdeForwardedFor(`  ${INVENTADA} , , ${VISITANTE}  `, 1)).toBe(VISITANTE);
  });

  // En local no hay proxy y el header no existe. Devolver null hace que no se
  // mande el header, y la API cae a su cupo compartido: peor para el visitante
  // legítimo, pero seguro.
  it.each([
    ["ausente", null],
    ["vacío", ""],
    ["solo comas", ",,,"],
    ["solo espacios", "   "],
  ])("devuelve null si el header está %s", (_caso, valor) => {
    expect(ipDesdeForwardedFor(valor, 1)).toBeNull();
  });

  it("si la cadena es más corta que los hops esperados no devuelve undefined", () => {
    // Pasa en local: se configuraron 2 proxies pero no hay ninguno.
    expect(ipDesdeForwardedFor(VISITANTE, 3)).toBe(VISITANTE);
  });

  it("un número de hops absurdo se trata como 1, no rompe", () => {
    const cadena = `${INVENTADA}, ${VISITANTE}`;
    expect(ipDesdeForwardedFor(cadena, 0)).toBe(VISITANTE);
    expect(ipDesdeForwardedFor(cadena, -5)).toBe(VISITANTE);
    expect(ipDesdeForwardedFor(cadena, 1.7)).toBe(VISITANTE);
  });

  it("soporta IPv6, que lleva dos puntos adentro", () => {
    expect(ipDesdeForwardedFor(`${INVENTADA}, 2001:db8::1`, 1)).toBe("2001:db8::1");
  });
});
