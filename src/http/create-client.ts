import axios, { AxiosInstance, CreateAxiosDefaults } from "axios";
import { cliodotHttpAgents } from "./localhost-lookup";

export function createCliodotAxios(
  config: CreateAxiosDefaults = {}
): AxiosInstance {
  return axios.create({
    ...cliodotHttpAgents(),
    ...config,
  });
}
