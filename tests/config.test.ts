import { afterEach, describe, expect, it } from "vitest";
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
    for (const clave of ["DATA_SOURCE", "API_URL", "NEXT_PUBLIC_API_URL"]) {
      delete process.env[clave];
    }
    Object.assign(process.env, env);
    resetConfigCache();
    return getConfig();
  };

  it("lee las tres variables", () => {
    const config = conEntorno({
      DATA_SOURCE: "api",
      API_URL: "http://api.local/api/v1",
      NEXT_PUBLIC_API_URL: "https://publica.local/api/v1",
    });
    expect(config.dataSource).toBe("api");
    expect(config.apiUrl).toBe("http://api.local/api/v1");
    expect(config.publicApiUrl).toBe("https://publica.local/api/v1");
  });

  it("saca la barra final para no generar URLs con //", () => {
    expect(conEntorno({ DATA_SOURCE: "api", API_URL: "http://api.local/v1///" }).apiUrl).toBe(
      "http://api.local/v1",
    );
  });

  it("si falta NEXT_PUBLIC_API_URL usa API_URL", () => {
    const config = conEntorno({ DATA_SOURCE: "api", API_URL: "http://api.local/v1" });
    expect(config.publicApiUrl).toBe("http://api.local/v1");
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

  it("cachea: se resuelve una vez, no por llamada", () => {
    const primera = conEntorno({ DATA_SOURCE: "mock" });
    process.env.DATA_SOURCE = "api";
    expect(getConfig()).toBe(primera);
  });
});
