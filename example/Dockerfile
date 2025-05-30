FROM ubuntu:22.04

# Create a startup script
RUN echo '#!/bin/bash\n\
echo "=== Mount Points ==="\n\
mount | grep -v "tmpfs" | grep -v "proc" | grep -v "sysfs"\n\
echo "=== End Mount Points ===\n\
exec tail -f /dev/null' > /start.sh && \
chmod +x /start.sh

CMD ["/start.sh"] 