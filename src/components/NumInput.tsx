import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number | "";
  onChange: (e: { target: { value: string } }) => void;
}

export default function NumInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  );
}
