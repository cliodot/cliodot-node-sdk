import type { ValidatorName, ValidatorConfig, ValidationGroupDef } from "./types/validator";

export class ValidatorBuilder {
  private _groups: ValidationGroupDef[] = [];

  group(fields: string[], validators: Array<{ name: ValidatorName; config?: ValidatorConfig }>): this {
    this._groups.push({ fields, validators });
    return this;
  }

  addGroup(group: ValidationGroupDef): this {
    this._groups.push(group);
    return this;
  }

  build(): ValidationGroupDef[] {
    return this._groups;
  }
}

export function validationGroups(): ValidatorBuilder {
  return new ValidatorBuilder();
}
