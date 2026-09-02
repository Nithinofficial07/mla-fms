import { TextField } from '@mui/material';

export function StepField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <TextField
      fullWidth
      margin="normal"
      label={label}
      type={type}
      value={value}
      required={required}
      helperText={helper}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
