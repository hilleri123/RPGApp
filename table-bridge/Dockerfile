FROM golang:1.23-bookworm AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /table-bridge ./cmd/table-bridge

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /table-bridge /usr/local/bin/table-bridge
ENTRYPOINT ["table-bridge"]
