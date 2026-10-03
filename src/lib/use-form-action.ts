import { startTransition, useActionState, useRef, type FormEvent } from "react";

type FormMessage = string | undefined;

// Like useActionState, but submitted through onSubmit so React doesn't reset
// the form afterwards — a validation error keeps everything the user typed.
// The action returns an error/status message, or undefined on success; pass
// `resetOnSuccess` for "add" forms that should clear once saved.
export function useFormAction(
  action: (state: FormMessage, formData: FormData) => Promise<FormMessage>,
  initialState: FormMessage,
  options: { resetOnSuccess?: boolean } = {},
) {
  const formRef = useRef<HTMLFormElement | null>(null);

  const [state, dispatch, pending] = useActionState(async (prev: FormMessage, formData: FormData) => {
    const result = await action(prev, formData);
    if (options.resetOnSuccess && result === undefined) formRef.current?.reset();
    return result;
  }, initialState);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return [state, onSubmit, pending] as const;
}
