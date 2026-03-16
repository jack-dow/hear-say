import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useRef, useState } from "react";

import { toastManager } from "@/components/ui/toast";

export type ConvexCallError = {
  error: unknown;
  message: string;
  code?: string;
};

export function isConvexCallError(value: unknown): value is ConvexCallError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "message" in value
  );
}

function handleConvexError(error: unknown): ConvexCallError {
  const isConvex = error instanceof ConvexError;
  const message = isConvex
    ? String(error.data?.message ?? error.data)
    : "An unexpected error occurred";
  const code = isConvex ? (error.data?.code as string | undefined) : undefined;

  toastManager.add({ title: "Error", description: message, type: "error" });

  return { error, message, code };
}

function useLoadingTracker() {
  const [isLoading, setIsLoading] = useState(false);
  const inFlightCount = useRef(0);

  return {
    isLoading,
    start() {
      inFlightCount.current += 1;
      if (inFlightCount.current === 1) setIsLoading(true);
    },
    end() {
      inFlightCount.current = Math.max(0, inFlightCount.current - 1);
      if (inFlightCount.current === 0) setIsLoading(false);
    },
  };
}

export function useSafeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
): Query["_returnType"] | undefined {

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useQuery(query, args === "skip" ? "skip" as const : args);
}

export type SafeMutation<Mutation extends FunctionReference<"mutation">> = ((
  args: Mutation["_args"],
) => Promise<FunctionReturnType<Mutation> | ConvexCallError>) & {
  isLoading: boolean;
};

export function useSafeMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): SafeMutation<Mutation> {
  const tracker = useLoadingTracker();
  const mutate = useMutation(mutation);

  const safe = async (
    args: Mutation["_args"],
  ): Promise<FunctionReturnType<Mutation> | ConvexCallError> => {
    tracker.start();
    try {
      return await mutate(args);
    } catch (error) {
      return handleConvexError(error);
    } finally {
      tracker.end();
    }
  };

  safe.isLoading = tracker.isLoading;

  return safe;
}

export type SafeAction<Action extends FunctionReference<"action">> = ((
  args: Action["_args"],
) => Promise<FunctionReturnType<Action> | ConvexCallError>) & {
  isLoading: boolean;
};

export function useSafeAction<Action extends FunctionReference<"action">>(
  action: Action,
): SafeAction<Action> {
  const tracker = useLoadingTracker();
  const act = useAction(action);

  const safe = async (
    args: Action["_args"],
  ): Promise<FunctionReturnType<Action> | ConvexCallError> => {
    tracker.start();
    try {
      return await act(args);
    } catch (error) {
      return handleConvexError(error);
    } finally {
      tracker.end();
    }
  };

  safe.isLoading = tracker.isLoading;

  return safe;
}
