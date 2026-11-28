import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSourceConfigError, parseDataSource } from "@/lib/data/data-source";
import { ConfigError, getConfig, resetConfigCache } from "@/lib/config";

describe("parseDataSource", () => {
  it("acepta los valores válidos", () => {
    expect(parseDataSource("api")).toBe("api");
    expect(parseDataSource("mock")).toBe("mock");
  });

  it("trimea los espacios, que es el error de tipeo más común en un .env", () => {
    expect(parseDataSource("  mock  ")).toBe("mock");
  });

  // Un default silencioso significa levantar contra la API real creyendo estar
  // en mocks, o al revés, y enterarse por los datos.
  it.each([
    ["ausente", undefined],
    ["vacío", ""],
    ["solo espacios", "   "],
  ])("falla si está %s, en vez de defaultear", (_caso, valor) => {
    expect(() => parseDataSource(valor)).toThrow(DataSourceConfigError);
    expect(() => parseDataSource(valor)).toThrow(/DATA_SOURCE/);
  });

  it("es sensible a mayúsculas a propósito", () => {
    expect(() => parseDataSource("API")).toThrow(DataSourceConfigError);
  });

  it("el error dice qué valores son válidos", () => {
    expect(() => parseDataSource("produccion")).toThrow(/api \| mock/);
  });
});

describe("getConfig", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    resetConfigCache();
  });

  const conEntorno = (env: Record<string, string | undefined>): ReturnType<typeof getConfig> => {
    for (const clave of ["DATA_SOURCE", "API_URL", "TRUSTED_PROXY_HOPS"]) {
      delete process.env[clave];
    }
    Object.assign(process.env, env);
    resetConfigCache();
    return getConfig();
  };

  it("lee las dos variables", () => {
    const config = conEntorno({ DATA_SOURCE: "api", API_URL: "http://api.local/api/v1" });
    expect(config.dataSource).toBe("api");
    expect(config.apiUrl).toBe("http://api.local/api/v1");
  });

  // No hay ninguna NEXT_PUBLIC_*: todo pedido a la API sale del server, así
  // que la misma imagen sirve staging y producción.
  it("no expone ninguna URL al bundle del browser", () => {
    const config = conEntorno({ DATA_SOURCE: "api", API_URL: "http://api.local/v1" });
    expect(Object.keys(config).some((clave) => clave.includes("ublic"))).toBe(false);
  });

  it("saca la barra final para no generar URLs con //", () => {
    expect(conEntorno({ DATA_SOURCE: "api", API_URL: "http://api.local/v1///" }).apiUrl).toBe(
      "http://api.local/v1",
    );
  });

  it("falla nombrando la variable que falta", () => {
    expect(() => conEntorno({ DATA_SOURCE: "api" })).toThrow(ConfigError);
    expect(() => conEntorno({ DATA_SOURCE: "api" })).toThrow(/API_URL/);
  });

  it("falla si no es una URL, en vez de dejar que explote el fetch", () => {
    expect(() => conEntorno({ DATA_SOURCE: "api", API_URL: "localhost-8000" })).toThrow(ConfigError);
  });

  // Con mocks no hay API: exigir las URLs obligaría a inventar valores falsos
  // en el .env solo para poder levantar sin backend.
  it("con mock no exige las URLs", () => {
    const config = conEntorno({ DATA_SOURCE: "mock" });
    expect(config.dataSource).toBe("mock");
  });

  describe("trustedProxyHops", () => {
    it("por defecto es 1, la topología real con Dokploy adelante", () => {
      expect(conEntorno({ DATA_SOURCE: "mock" }).trustedProxyHops).toBe(1);
    });

    it("se puede subir si se agrega otro proxy", () => {
      expect(
        conEntorno({ DATA_SOURCE: "mock", TRUSTED_PROXY_HOPS: "2" }).trustedProxyHops,
      ).toBe(2);
    });

    // Un typo en una variable opcional no puede dejar al sitio sin formulario.
    it.each(["0", "-1", "dos", "1.5", ""])("un valor inválido (%s) cae a 1 sin romper", (valor) => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(
        conEntorno({ DATA_SOURCE: "mock", TRUSTED_PROXY_HOPS: valor }).trustedProxyHops,
      ).toBe(1);
      spy.mockRestore();
    });
  });

  it("cachea: se resuelve una vez, no por llamada", () => {
    const primera = conEntorno({ DATA_SOURCE: "mock" });
    process.env.DATA_SOURCE = "api";
    expect(getConfig()).toBe(primera);
  });
});
