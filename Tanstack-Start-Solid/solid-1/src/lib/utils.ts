// [bd-file:tailwind]
// Solid UI's class-name helper: joins classes, and later Tailwind classes
// win over earlier ones that clash.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
