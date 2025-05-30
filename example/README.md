# Example Container

This is a simple example container that:
1. Uses Ubuntu 22.04 as the base image
2. Prints all mount points (excluding system mounts) at startup
3. Keeps running using `tail -f /dev/null`

## Building

```bash
docker build -t example-container .
```

## Running

```bash
docker run -v /path/to/volume:/data example-container
```

## Testing with Fly

```bash
# Build and push the image
flyctl image build -t example-container .
flyctl image push example-container

# Create a machine with the image
flyctl machine create example-container --volume /data:/data
```

The container will print its mount points at startup, which is useful for verifying that volumes are mounted correctly. 