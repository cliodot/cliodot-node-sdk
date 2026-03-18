export function executeMath(opts: any, actionMethod: string): any {
  const o = opts;
  switch (actionMethod) {
    case "add": {
      const numbers = o.numbers ?? (o.a !== undefined && o.b !== undefined ? [o.a, o.b] : [o.a ?? o.value ?? 0, o.b ?? 0]);
      if (!Array.isArray(numbers)) return { value: Number(o.a ?? o.value ?? 0) + Number(o.b ?? 0) };
      return { value: numbers.reduce((sum: number, n: any) => sum + Number(n), 0) };
    }
    case "subtract": {
      const a = o.a ?? o.numbers?.[0] ?? o.value ?? 0;
      const b = o.b ?? o.numbers?.[1] ?? 0;
      return { value: Number(a) - Number(b) };
    }
    case "multiply": {
      const numbers = o.numbers ?? [o.a ?? 1, o.b ?? 1];
      if (!Array.isArray(numbers)) return { value: Number(o.a ?? 1) * Number(o.b ?? 1) };
      return { value: numbers.reduce((prod: number, n: any) => prod * Number(n), 1) };
    }
    case "divide": {
      const dividend = o.dividend ?? o.a ?? o.value ?? 0;
      const divisor = o.divisor ?? o.b ?? 1;
      if (divisor === 0) throw new Error("Division by zero is not allowed");
      let result = Number(dividend) / Number(divisor);
      if (o.precision !== undefined) result = parseFloat(result.toFixed(o.precision));
      return { value: result };
    }
    case "modulo": {
      const { dividend, divisor } = o;
      if (dividend === undefined || divisor === undefined) throw new Error("Dividend and divisor are required");
      return { value: Number(dividend) % Number(divisor) };
    }
    case "power": {
      const { base, exponent } = o;
      if (base === undefined || exponent === undefined) throw new Error("Base and exponent are required");
      return { value: Math.pow(Number(base), Number(exponent)) };
    }
    case "round": {
      const { number, decimals = 0 } = o;
      if (number === undefined) throw new Error("Number is required");
      return { value: parseFloat(Number(number).toFixed(decimals)) };
    }
    case "floor": {
      const { number } = o;
      if (number === undefined) throw new Error("Number is required");
      return { value: Math.floor(Number(number)) };
    }
    case "ceil": {
      const { number } = o;
      if (number === undefined) throw new Error("Number is required");
      return { value: Math.ceil(Number(number)) };
    }
    case "abs": {
      const { number } = o;
      if (number === undefined) throw new Error("Number is required");
      return { value: Math.abs(Number(number)) };
    }
    case "min": {
      const { numbers } = o;
      if (!Array.isArray(numbers) || numbers.length === 0) throw new Error("Numbers array is required and must not be empty");
      return { value: Math.min(...numbers.map((n: any) => Number(n))) };
    }
    case "max": {
      const { numbers } = o;
      if (!Array.isArray(numbers) || numbers.length === 0) throw new Error("Numbers array is required and must not be empty");
      return { value: Math.max(...numbers.map((n: any) => Number(n))) };
    }
    case "average": {
      const { numbers, precision } = o;
      if (!Array.isArray(numbers) || numbers.length === 0) throw new Error("Numbers array is required and must not be empty");
      const sum = numbers.reduce((s: number, n: any) => s + Number(n), 0);
      let avg = sum / numbers.length;
      if (precision !== undefined) avg = parseFloat(avg.toFixed(precision));
      return { value: avg };
    }
    case "sum": {
      const { numbers } = o;
      if (!Array.isArray(numbers)) throw new Error("Numbers array is required");
      return { value: numbers.reduce((sum: number, n: any) => sum + Number(n), 0) };
    }
    case "clamp": {
      const { number, min, max } = o;
      if (number === undefined || min === undefined || max === undefined) throw new Error("Number, min, and max are required");
      const num = Number(number);
      return { value: Math.min(Math.max(num, Number(min)), Number(max)) };
    }
    case "random_between": {
      const { min, max, integer = false, precision = 2 } = o;
      if (min === undefined || max === undefined) throw new Error("Min and max are required");
      const value = Math.random() * (Number(max) - Number(min)) + Number(min);
      return { value: integer ? Math.floor(value) : parseFloat(value.toFixed(precision)) };
    }
    case "percentage": {
      const { value, total, precision = 2 } = o;
      if (value === undefined || total === undefined) throw new Error("Value and total are required");
      if (total === 0) throw new Error("Total cannot be zero");
      const percent = (Number(value) / Number(total)) * 100;
      return { value: parseFloat(percent.toFixed(precision)) };
    }
    case "percentage_of": {
      const { percentage, of, precision = 2 } = o;
      if (percentage === undefined || of === undefined) throw new Error("Percentage and of are required");
      const result = (Number(percentage) / 100) * Number(of);
      return { value: parseFloat(result.toFixed(precision)) };
    }
    case "sqrt": {
      const { number, precision } = o;
      if (number === undefined) throw new Error("Number is required");
      if (number < 0) throw new Error("Cannot calculate square root of negative number");
      let result = Math.sqrt(Number(number));
      if (precision !== undefined) result = parseFloat(result.toFixed(precision));
      return { value: result };
    }
    case "log": {
      const { number, base, precision } = o;
      if (number === undefined) throw new Error("Number is required");
      if (number <= 0) throw new Error("Number must be greater than zero");
      let result = base ? Math.log(Number(number)) / Math.log(Number(base)) : Math.log(Number(number));
      if (precision !== undefined) result = parseFloat(result.toFixed(precision));
      return { value: result };
    }
    default:
      return { value: Number(o.value ?? o.a ?? 0) };
  }
}
