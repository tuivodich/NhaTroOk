interface Props { value?: number | null; suffix?: string; }
export default function MoneyText({ value, suffix }: Props) {
  if (value == null) return <span>—</span>;
  const formatted = new Intl.NumberFormat("vi-VN").format(value);
  return <span>{formatted}{suffix ? " " + suffix : " đ"}</span>;
}
